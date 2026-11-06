# Brief dev : l'assistant de /contact doit être un agent, pas un formulaire

Destinataire : Raj
Auteur : Sujee (via Sita)
Statut : à valider avant développement
Périmètre : chat de la page `/contact`, backend `app/agent/`

---

## 1. Résumé

Le chat de contact fonctionne techniquement : la demande arrive dans l'admin, le rendez-vous se crée dans Google Agenda, les deux mails partent avec le fichier calendrier. Ce n'est pas le sujet.

Le problème est ailleurs : **le visiteur parle à un formulaire déguisé en conversation**. Il suit un chemin figé, ne comprend pas ce qu'on lui écrit en dehors des clous, et refuse toutes les questions qu'on lui pose. L'objectif de ce brief est de transformer un questionnaire scripté en agent capable de comprendre, répondre et qualifier.

La cible en une phrase : **quelqu'un écrit ce qu'il veut, l'agent comprend, répond utilement, retient ce qui est déjà dit, et ouvre un créneau sans jamais reposer une question déjà répondue.**

---

## 2. Diagnostic, preuves à l'appui

Le moteur est bon et reste : Mistral avec appels d'outils (`app/agent/engine.py`), état de session côté serveur, outils `record_fields`, `request_slots`, `book_meeting`, `save_lead`, `handoff_form`. La plomberie tient.

Ce qui bloque, c'est le prompt système (`app/agent/prompt.py`) :

- Ligne 11 : « Trois questions suffisent. Dès que tu les as, tu vas au rendez-vous. » Le prompt verrouille l'ordre et interdit d'aller plus loin.
- Ligne 22 : « Tu ne donnes aucun tarif et tu ne demandes jamais de budget. »
- Le même bloc impose deux phrases maximum, une seule question, aucun récapitulatif, aucun conseil.

Conséquence observable en production : à la question « matin ou après-midi », j'ai répondu « budget autour de 3 000 euros, lancement en mars ». L'assistant a reposé la même question, à l'identique, sans un mot. Même chose sur une adresse email invalide : la question est répétée sans explication.

Autrement dit : le modèle est bridé au point de ne plus pouvoir converser. Un agent qui doit suivre un chemin figé et refuser toutes les questions n'est pas un agent, c'est un formulaire avec une animation de frappe.

Autres constats mesurés, à traiter dans le même lot :

- Le parcours annonce « trois questions » et en pose neuf (type, nom de marque, secteur, moment, créneau, prénom nom, email, téléphone, visio ou appel).
- Le budget n'est jamais collecté par le chat, alors que le formulaire de secours a un champ « Budget envisagé ».
- Aucun filtre sur les jours fériés (`app/agent/slots.py`, ligne 109 exclut seulement les week-ends) : le 11 novembre à 09h30 a été proposé.
- Le compteur de progression reste à 0 % : `STEPS` (`web/components/pages/ContactChat.tsx`, ligne 27) ne connaît pas les étapes `moment` et `coordonnees` envoyées par le serveur (`app/agent/tools.py`, lignes 197 et 464), donc `findIndex` renvoie -1 et la progression retombe à zéro.
- Sur mobile 390, le texte d'aide du champ est coupé : 38 px de haut pour 59 px de contenu.

---

## 3. Ce qu'est un agent, ce qu'il n'est pas

**Un agent**
- Comprend une demande en langage libre et en extrait les informations utiles, même dispersées dans une phrase.
- Répond aux questions qu'on lui pose avant de qualifier.
- Décide lui-même de l'ordre et du nombre de questions, en ne posant que celles qui manquent.
- Reconnaît qu'on lui a déjà répondu et ne redemande pas.
- Sait dire « je ne sais pas » ou « ça se précisera à l'appel » plutôt que d'inventer.
- Recadre poliment quand on sort du sujet, et passe la main à un humain quand on le demande.

**Ce qu'il n'est pas**
- Une suite de questions à choix multiples déguisée en bulles de chat.
- Un refus systématique dès qu'on parle d'argent.
- Un générateur de réponses identiques quel que soit le message reçu.

**Le test qui tranche** : deux messages différents ne doivent jamais produire la même réponse mot pour mot. Si c'est le cas, ce n'est pas un agent.

---

## 4. Exigences fonctionnelles

**F1. Compréhension libre et extraction**
Chaque message est analysé pour en extraire les champs utiles : type de projet, nom de marque, secteur, budget, échéance, besoin exprimé. Un seul message peut remplir plusieurs champs. Une phrase comme « je veux un logo et un site pour ma marque de savons, budget 4 000, lancement en mars » doit enregistrer tout ce qui est présent et ne poser que ce qui manque.

**F2. Réponse avant question**
Quand le visiteur pose une question, l'agent y répond d'abord, brièvement, puis rebondit avec au plus une question. Il ne répond plus « c'est le rôle de l'appel » à une demande de fourchette de prix.

**F3. Budget qualifié**
Le budget devient un champ, avec une fourchette proposée en boutons (par exemple moins de 1 500, 1 500 à 4 000, 4 000 à 8 000, plus de 8 000, à définir). Enregistré dans le lead, visible dans l'admin. Un budget annoncé spontanément est noté, pas ignoré.

**F4. Aucune question redondante**
L'état serveur fait foi. Ce qui est déjà connu n'est jamais redemandé, y compris après un rechargement de page.

**F5. Réponses factuelles et sourcées**
Toute réponse sur les prestations, la méthode, les délais ou les prix s'appuie sur le contenu réel du site (pages services, guides, cas clients). Aucun chiffre inventé. Si l'information manque, l'agent le dit et renvoie à l'appel.

**F6. Recadrage explicite**
Un message hors script reçoit une phrase de reconnaissance, même courte, avant de revenir au sujet. Un email invalide déclenche un message clair, pas une répétition muette.

**F7. Passage à l'humain**
Une demande explicite de contact humain déclenche `handoff_form` immédiatement, sans finir la qualification.

**F8. Cohérence de la promesse**
Le texte d'accroche ne promet plus « trois questions ». Soit on annonce « quelques questions et un créneau », soit on regroupe prénom et nom pour tenir la promesse. Le premier est immédiat, le second est plus propre.

---

## 5. Pistes techniques

**Le prompt devient un objectif, pas un script.**
On garde : le rôle, le ton, le vouvoiement, la brièveté, une question à la fois, l'interdiction des listes et du gras.
On supprime : l'ordre imposé, le plafond de deux phrases, l'interdiction du budget, l'interdiction de répondre aux questions.

**Un outil de connaissance**
Ajouter un outil de consultation en lecture seule sur le contenu éditorial du site (prestations, guides, cas clients, FAQ), avec des extraits courts et sourcés. L'agent cite la page quand il donne une fourchette ou un exemple. C'est ce qui l'empêche d'inventer et ce qui lui permet de répondre vraiment.

**Extraction structurée**
Le modèle appelle `record_fields` autant de fois que nécessaire dans un même tour, avec les champs détectés. Le serveur valide, normalise (budget en tranche, échéance en date ou en mois) et renvoie l'état à jour.

**Slots**
Ajouter une liste de jours fériés (France) ou une table de dates bloquées en base, avec un test sur le 11 novembre, le 25 décembre et le 1er mai.

**Interface**
Corriger `STEPS` pour inclure `moment` et `coordonnees`, ou calculer la progression sur les champs remplis, ce qui est plus honnête et plus simple à maintenir.
Passer le champ de saisie à 44 px de haut minimum sur mobile, ou raccourcir le texte d'aide.
Ajouter deux boutons à la question visio ou appel.

**Observabilité**
Journaliser chaque tour : message reçu, champs extraits, outils appelés, réponse envoyée, durée. Sans ça, impossible de savoir si l'agent progresse ou s'il répète. Prévoir un accès en lecture dans l'admin, même brut.

---

## 6. Garde-fous, non négociables

- Aucun prix ferme, aucune remise, aucun engagement de délai. Des fourchettes, jamais un devis.
- Aucune référence client inventée, aucun chiffre de résultat inventé.
- Aucun conseil juridique, fiscal ou réglementaire.
- Données personnelles inchangées : consentement explicite, conservation 24 mois, aucune revente.
- La création du rendez-vous reste la seule action à effet réel, avec la même protection contre les doubles réservations.
- La page reste rapide : première réponse en quelques secondes.

---

## 7. Matrice de recette

Douze scénarios à passer avant livraison. Pour chacun : le message exact, le comportement attendu, et le critère d'échec.

**S1. Besoin complet en une phrase**
Message : « Bonjour, je veux un logo et un site pour ma marque de savons bio, budget 4 000 euros, lancement en mars. »
Attendu : enregistre le type, le secteur, le budget et l'échéance. Ne demande que le nom de la marque s'il manque. Aucune question déjà répondue.
Échec : il redemande le budget, le secteur ou l'échéance.

**S2. Question de prix**
Message : « Combien coûte un logo ? »
Attendu : une fourchette issue du contenu du site, une phrase sur ce qui fait varier le prix, puis une question. Pas de devis ferme.
Échec : « Je ne donne pas de tarifs ici, c'est le rôle de l'appel » seul, sans aucune information.

**S3. Question de méthode**
Message : « Concrètement, ça se passe comment ? »
Attendu : trois ou quatre étapes en une ou deux phrases, ancrées dans la méthode publiée, puis une question.
Échec : réponse générique sans lien avec le déroulé réel.

**S4. Budget spontané au milieu du parcours**
Message : « Mon budget tourne autour de 2 500 euros. »
Attendu : enregistré, confirmé en une phrase, la conversation continue sans reposer la question.
Échec : le budget est ignoré ou la question précédente est répétée.

**S5. Besoin imprécis**
Message : « Je veux refaire mon image, je ne sais pas trop par où commencer. »
Attendu : une phrase de reformulation, une seule question pour cadrer, aucune liste de prestations.
Échec : il enchaîne sur une grille de questions sans reformuler.

**S6. Nom de marque non défini**
Message : « Je n'ai pas encore choisi le nom. »
Attendu : enregistre « à définir », continue, ne revient pas dessus.
Échec : il insiste ou bloque le parcours.

**S7. Demande de contact humain**
Message : « Je peux parler à quelqu'un directement ? »
Attendu : formulaire de reprise en main immédiat, sans finir la qualification.
Échec : il continue à poser des questions.

**S8. Sortie de sujet**
Message : « Tu peux m'aider à faire mes devoirs ? »
Attendu : recadrage en une phrase, retour au projet, sans moraliser.
Échec : silence, ou réponse qui accepte la demande.

**S9. Disponibilité hors créneaux**
Message : « Je ne suis disponible que le samedi. »
Attendu : alternative réaliste (échange par mail, visio en semaine, rappel), sans proposer un samedi comme s'il existait.
Échec : il propose un créneau qui n'existe pas, ou il répète la question.

**S10. Reprise après rechargement**
Action : répondre à trois questions, recharger la page en milieu de parcours.
Attendu : la conversation reprend au bon endroit, sans reposer les trois réponses.
Échec : redémarrage à zéro.

**S11. Message en anglais**
Message : « Hi, I need a logo for my bakery. »
Attendu : réponse en anglais, même parcours, même champs.
Échec : réponse en français, ou incompréhension.

**S12. Projet hors catalogue**
Message : « Vous développez des applications mobiles ? »
Attendu : réponse honnête sur le périmètre réel, proposition d'alternative si pertinent, sans inventer une compétence.
Échec : « oui, bien sûr » ou un refus sec sans issue.

**S13. Doublon de formulation (test de non-formulaire)**
Action : poser trois fois une question proche, formulée différemment (« c'est combien un logo », « quel budget pour une identité visuelle », « ça part de combien »).
Attendu : trois réponses différentes dans la forme, cohérentes sur le fond.
Échec : trois réponses identiques au caractère près.

**S14. Email invalide**
Message : « sita.test » à la demande d'email.
Attendu : message explicite du type « il manque le @ et le domaine », puis redemande.
Échec : la question est reposée à l'identique, sans explication.

---

## 8. Critères d'acceptation

- Zéro question redondante sur l'ensemble de la matrice.
- Au moins une réponse utile avant la première question de qualification, sur tous les scénarios où une question est posée.
- Aucun chiffre tarifaire absent du contenu du site, vérifié sur 20 transcripts tirés au hasard.
- Parcours complet possible sur desktop 1280 et mobile 390, sans débordement ni texte coupé.
- Rendez-vous créé, événement dans l'agenda, deux mails reçus avec le fichier calendrier.
- Aucun jour férié proposé.
- Première réponse sous 4 secondes au 95e centile.
- Journal des tours consultable pour la revue hebdomadaire.
- Les tests existants restent verts.

---

## 9. Hors périmètre

Refonte visuelle du chat, changement de fournisseur de modèle (Mistral reste), voix, multilingue au-delà de l'anglais, paiement en ligne, CRM externe.

---

## 10. Découpage

**Lot 1, la différence se joue ici**
Prompt réécrit en objectif, extraction libre, budget, recadrage, reprise après rechargement, jours fériés, corrections d'interface, et passage des quatorze scénarios.

**Lot 2, la qualité**
Outil de connaissance sur le contenu du site, réponses sourcées, journal des tours dans l'admin, mail de confirmation enrichi du brief (type de projet, nom de marque).

---

## 11. Ce qui ne change pas

Le rendez-vous dans Google Agenda, la fiche dans l'admin, les deux mails et le fichier calendrier, le formulaire de secours, le consentement et la durée de conservation, la mesure de consultation déjà en place.
