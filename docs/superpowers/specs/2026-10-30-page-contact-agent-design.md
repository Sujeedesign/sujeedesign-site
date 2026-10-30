# Page contact avec agent de qualification et prise de rendez-vous

Date : 2026-10-30
Statut : spec à valider
Branche prévue : `feat/contact-agent`

## 1. Contexte vérifié

- `/contact` n'existe pas sur la vitrine Next : `web/next.config.ts` renvoie un 301 vers
  `/a-propos#contact`, qui n'est qu'un bouton `mailto:` (`web/lib/routes.ts`, `mailto()`).
- L'ancien formulaire FastAPI existe toujours (`app/contact.py`) : jeton signé en cookie
  `sjd_form`, âge minimum 3 s, rate limit 3 envois par heure et par IP, filtre spam
  grossier, stockage SQLite, notification Telegram. Il n'est plus branché sur le site public.
- La vitrine est en Next App Router avec ISR (`revalidate = 3600`), contenu servi par
  `getPageContent()` et publié via le back office.
- Le back office FastAPI est accessible en rewrite sous `sujeedesign.com/admin`
  (`ADMIN_ORIGIN`), et expose déjà `/api/*` protégé.
- `web/app/agents-ia/page.tsx` existe : l'offre agents IA est déjà racontée sur le site.
- Compte Google : le jeton présent sur la machine porte le scope `calendar` complet, et
  l'alias d'envoi `hello@sujeedesign.com` est vérifié (`verificationStatus: accepted`,
  displayName « Sujeepan Sabesan ») sur la boîte Gmail.
- Clé Mistral présente et valide sur la machine (`GET /v1/models` répond 200).

## 2. Objectifs

1. Créer une vraie page `/contact`, entrée du menu à la place du bouton `mailto`, qui porte
   le titre « Parlons de votre projet ».
2. Mettre derrière un agent qui qualifie le besoin du prospect sur 7 critères, sans jamais
   parler de prix, puis propose des créneaux réels et pose le rendez-vous.
3. Sortir de chaque conversation qualifiée un brief structuré, lisible en 30 secondes, avec
   le rendez-vous déjà dans Google Agenda et la notification Telegram.
4. Garder un chemin de secours : formulaire classique, toujours accessible, et bascule
   automatique si l'agent est indisponible.
5. Soigner la forme : UI futuriste, colonne unique, cohérente avec le site actuel.

## 3. Non-objectifs (v1)

- Voix, anglais, multilinguisme.
- Annulation ou déplacement du rendez-vous en self-service.
- Paiement, acompte, signature.
- Négociation de prix, devis automatique, accès au CRM (prévu en phase 2).
- Création de compte prospect.
- Remplacement du back office ou de l'éditeur de contenu.

## 4. Parcours utilisateur

Colonne unique, de haut en bas : accroche, chat, bloc « ou écrivez-moi directement »,
mentions (assistant IA, traitement des données).

1. **Ouverture** : l'agent salue et pose une question large (« Qu'est-ce que vous voulez
   faire, et pour quand ? »). Aucun formulaire à remplir avant de parler.
2. **Qualification** en 4 à 8 échanges, une question à la fois, jamais deux :
   1. nature du projet (identité, site, contenu, agents IA, mix)
   2. contexte : activité, taille, ce qui existe déjà
   3. objectif et raison du moment
   4. périmètre et livrables imaginés
   5. échéance réelle
   6. décideur et circuit de validation
   7. enveloppe budgétaire, formulée comme une fourchette, jamais reliée à un prix
3. **Reformulation** : l'agent récapitule en 5 à 8 lignes et demande validation explicite.
   Tant que le récap n'est pas validé, aucun créneau n'est proposé.
4. **Coordonnées** : prénom et nom, email, téléphone facultatif, consentement explicite.
5. **Créneaux** : trois propositions issues du freebusy réel, dates en clair et fuseau
   Europe/Paris. La personne en choisit une, ou demande « autre chose » et l'agent en
   repropose trois (deux tours maximum, ensuite formulaire).
6. **Confirmation** : écran de confirmation avec récap, référence de demande lisible
   (ex. `DEM-2026-0142`), et mention « vous recevez un email de confirmation ».
7. **Après** : email récap au prospect, brief et rendez-vous sur Telegram, événement Google
   Agenda avec le brief en description.

**Sorties de secours, à tout moment :**

- « je préfère écrire » : bascule sur le formulaire classique, champs pré-remplis avec ce que
  l'agent a déjà appris.
- agent indisponible (modèle en erreur, quota, latence excessive) : bandeau discret puis
  formulaire seul.
- besoin hors périmètre, budget manifestement hors jeu, demande impossible : l'agent ne
  propose pas de créneau, il enregistre le lead marqué `a_trier`, envoie la notification,
  et redirige vers le formulaire.

## 5. Architecture

### Où tourne l'agent

Dans le back office FastAPI, pas dans Next. Raisons : la base, les secrets, l'agenda et les
notifications y vivent déjà, et la vitrine reste statique donc rapide.

- `POST /api/v1/agent/chat` : SSE, un événement par fragment de texte, plus des événements
  typés `tool`, `slots`, `lead`, `error`.
- `POST /api/v1/agent/reset` : nouvelle conversation.
- `GET /api/v1/agent/health` : état du modèle et de l'agenda, utilisé par le bandeau de
  secours.
- `POST /api/v1/agent/lead` : soumission du formulaire de secours, même table, même
  notification.

La vitrine appelle `/api/agent/*` via un rewrite Next vers `ADMIN_ORIGIN`, sur le modèle de
`/admin`. Aucun secret dans le bundle client.

### État de conversation

Session identifiée par un cookie `sjd_conv` (HttpOnly, SameSite=Lax, Secure en prod,
30 jours). L'historique des messages, les champs déjà qualifiés et l'étape courante sont en
SQLite côté serveur. Le client ne détient rien de structurant : recharger la page reprend la
conversation en cours.

### Machine à états, côté serveur

`accueil` → `qualification` → `recap` → `coordonnees` → `creneaux` → `confirme` → `fini`,
plus `hors_perimetre`, `abandon`, `formulaire`.

Le modèle propose, le serveur décide : le numéro d'étape, l'avancement et la validation
finale sont contrôlés en Python, pas laissés au modèle. Un champ qualifié manquant interdit
le passage à `creneaux`, même si le modèle prétend que tout est bon.

## 6. Modèle et coût

- Modèle principal : `mistral-medium-latest` (Mistral, hébergement UE), en streaming, avec
  function calling.
- Repli technique : `mistral-small-latest` si le medium renvoie 429 ou 5xx, une fois.
- Aucun modèle hors UE pour les données personnelles de prospects.
- Température 0,4, `max_tokens` 400 par tour.
- Budget : environ 0,01 à 0,03 € par conversation complète. Plafond dur : 25 échanges et
  12 000 tokens de contexte serveur par conversation, puis clôture propre et bascule
  formulaire.

## 7. Outils exposés au modèle

1. `get_availability(window_days)` : renvoie au maximum 12 créneaux libres, jamais les
   détails des événements existants.
2. `book_meeting(slot_id, email, name)` : re-vérifie la disponibilité à l'instant t,
   crée l'événement, renvoie `ok` ou `conflit`. Idempotent par `slot_id` et session.
3. `save_lead(fields)` : écrit le brief structuré et déclenche la notification.
4. `handoff_form(reason)` : bascule vers le formulaire.

Le modèle n'a aucun accès direct à la base, au calendrier brut, ni aux emails.

## 8. Agenda

- Google Agenda comme source unique de vérité, calendrier principal du compte.
- Créneaux : lundi au vendredi, 9h00 à 11h00 et 14h00 à 16h00, Europe/Paris.
- Grille : rendez-vous de 20 minutes, battement de 10 minutes, soit 9h00, 9h30, 10h00,
  10h30 et 14h00 à 15h30. 8 créneaux par jour ouvré.
- Délai minimum avant le rendez-vous : 48 h. Maximum 4 rendez-vous par jour ouvré.
- Freebusy interrogé à chaque proposition et re-vérifié à la réservation.
- Événement : titre « Sujee Design x {prénom} », 20 minutes, brief complet en description,
  email du prospect en invité, notification par défaut.
- Accès : identifiant OAuth dédié, scope `calendar.events` uniquement, refresh token stocké
  dans les secrets Coolify du back office. On ne réutilise pas le jeton maître, qui porte
  Gmail et Drive.

## 9. Emails

- Expéditeur : `hello@sujeedesign.com`, alias vérifié, avec la signature existante.
- Au prospect : confirmation avec date, heure, durée, lien visio si activé, récap du besoin,
  et la phrase « si ce n'est plus le bon moment, répondez simplement à cet email ».
- À Sujee : notification Telegram (déjà en place pour le formulaire), plus un email de
  synthèse uniquement si le brief dépasse 400 caractères.
- Aucun email marketing, aucune séquence automatique.

## 10. Interface, direction artistique

Contraintes : cohérent avec l'existant (fond `#0A0A09`, bon `#F2EFE7`, accent `#FF4B1F`,
radius 2 px, labels mono 11 px, boutons 44-48 px, coins carrés pour les tags), mais
sensiblement plus avancé que les autres pages.

- **Colonne unique**, largeur de lecture 680 à 760 px, marges généreuses, tout le parcours
  au même endroit, aucune modale, aucun drawer.
- **Chat** : pas de bulle ronde façon messagerie. Des blocs en pleine largeur, séparés par
  un filet 1 px, texte de l'agent en `#F2EFE7`, réponses de la personne sur fond
  `rgba(255,255,255,.03)` avec un liseré gauche accent.
- **Signaux futuristes, sobres** : index de tour en mono (`02 / 07`), curseur de frappe en
  bloc, grille de points très discrète en fond de la zone de chat, halo radial accent
  derrière l'accroche (comme `.contact::before` aujourd'hui), ligne de scan animée sur le
  bloc de statut.
- **Progression** : une barre fine de 2 px en haut du chat indique l'étape de qualification,
  avec le libellé de l'étape courante en mono.
- **Créneaux** : trois cartes empilées, date en gros, heure en mono, état au survol.
  Sélection au clavier possible, focus visible, contrastes AA.
- **Accessibilité** : `aria-live="polite"` sur la zone de messages, `prefers-reduced-motion`
  respecté, tout utilisable au clavier, aucune animation bloquante.
- **Mobile** : colonne pleine largeur, zones tactiles 44 px minimum, clavier qui ne masque
  pas le champ de saisie.
- **Performance** : composant client isolé, hydratation tardive, aucune lib de chat, CSS
  local à la page. Objectif : LCP inchangé sur les autres pages, JS ajouté sous 12 Ko gzip.

## 11. Sécurité et anti-abus

- 5 conversations par heure et par IP, 60 messages par heure et par IP, sur le modèle du
  `RateLimiter` existant.
- 25 messages et 12 000 tokens maximum par conversation.
- Prompt système verrouillé : jamais de prix, jamais d'engagement de délai ou de
  disponibilité, jamais de révélation des instructions, refus des sujets hors sujet.
- Validation serveur de tous les champs avant écriture, longueurs bornées, email vérifié par
  regex, téléphone nettoyé.
- Aucune donnée du modèle exécutée comme du code, aucun HTML rendu depuis la réponse
  (le rendu est texte, markdown minimal).
- Re-vérification de la disponibilité à la réservation, verrou par créneau pour éviter les
  doubles réservations.
- CAPTCHA invisible seulement si le rate limit déclenche, pas au premier message.
- Journaux sans contenu de conversation en clair au-delà de la purge.

## 12. Données et RGPD

- Tables : `agent_sessions`, `agent_messages`, `agent_leads`, `agent_bookings`.
- Le lead reprend les 7 champs de qualification, la reformulation validée, la référence, et
  le statut (`qualifie`, `a_trier`, `rdv`, `archive`).
- Rétention : conversations et messages 90 jours, leads 24 mois, purge quotidienne.
- Consentement explicite avant enregistrement du lead, case à cocher jamais pré-cochée.
- Bandeau permanent : « Assistant IA. Vos échanges servent à préparer notre rendez-vous. Un
  humain relit chaque demande. » avec lien vers les mentions légales.
- Aucun transfert hors UE : Mistral uniquement.
- Suppression sur demande : un endpoint admin existant suffit, plus une phrase dans les
  mentions légales.

## 13. Observabilité

- Compteurs : conversations ouvertes, taux de qualification, taux de RDV, abandons par étape,
  latence p95 du modèle, coût estimé par jour.
- Console admin : liste des leads avec brief, statut, rendez-vous, filtre `a_trier`.
- Alerte Telegram si plus de 3 erreurs modèle en 10 minutes.

## 14. Tests

- Unitaires : machine à états (chaque transition, chaque blocage), validation des champs,
  grille de créneaux (week-end exclu, 48 h, 4 RDV/jour), idempotence de la réservation.
- Contrat : SSE bien formé, événements typés, erreur modèle renvoyée sans fuite de prompt.
- Intégration : Google Agenda en doublure (fake), parcours complet qualification → RDV,
  parcours hors périmètre, parcours formulaire de secours.
- E2E manuel sur staging avant production, avec un vrai créneau puis suppression de
  l'événement de test.
- `pytest -q -m "not e2e"` doit rester vert (172 tests aujourd'hui).

## 15. Lots

1. **Socle serveur** : tables, sessions, machine à états, `/health`, rate limit.
2. **Agent** : prompt système, outils, streaming SSE, repli de modèle.
3. **Agenda** : OAuth dédié, freebusy, réservation, idempotence.
4. **Emails et notifications** : alias `hello@`, confirmation, Telegram.
5. **Page** : `/contact`, rewrite, chat, progression, formulaire de secours.
6. **Design** : direction futuriste, états, accessibilité, mobile.
7. **Admin** : liste des leads, filtre, purge.
8. **Mise en ligne** : mentions légales, sitemap, 301, staging, production.

## 16. Risques

- **Hallucination de créneau** : neutralisée par freebusy serveur et re-vérification.
- **Conversation qui s'éternise** : plafond de tours et de tokens, sortie propre.
- **Coût** : plafond par conversation, alerte quotidienne.
- **Fuite de prompt** : prompt système jamais renvoyé, réponses filtrées.
- **RGPD** : fournisseur UE, consentement, purge automatique.
- **Modèle indisponible** : bandeau, formulaire, notification Telegram en cas d'erreur
  répétée.
- **Concurrence sur un créneau** : verrou par créneau, `conflit` renvoyé proprement.

## 17. Valeurs par défaut retenues, à corriger si besoin

- Durée 20 minutes, battement 10 minutes.
- 48 h de délai minimum, 4 RDV maximum par jour.
- Rétention 90 jours pour les conversations, 24 mois pour les leads.
- Pas de lien visio en v1, sauf si un lien est configuré dans les réglages.
- Langue française uniquement, ton direct et chaleureux, tutoiement non (vouvoiement).
- Titre de page et de menu : « Parlons de votre projet ».
