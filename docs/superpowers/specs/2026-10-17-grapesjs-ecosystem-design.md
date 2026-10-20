# Écosystème d’édition visuelle réutilisable basé sur GrapesJS Core

Date : 17 octobre 2026  
Statut : spec rédigée après validation du principe ; en attente de revue utilisateur  
Remplace les décisions d’architecture incompatibles de `2026-10-17-editeur-blocs-design.md`. Les exigences d’usage qui restent compatibles sont conservées comme contraintes, pas comme décisions techniques.

## 1. But

Construire un écosystème d’édition visuelle basé sur **GrapesJS Core gratuit et auto-hébergé**, réutilisable sur les sites réalisés pour Sujee et ses clients. Le site est conçu comme un thème composé de sections ; son administrateur modifie les pages en contexte, change textes et images, et ajoute/réordonne des sections sans perdre l’identité graphique du thème.

Le premier site pilote sera la refonte de `sujeedesign.com`. L’éditeur doit être pensé dès le départ pour être intégré à d’autres sites, sans copier son code ni imposer un backend identique à tous.

La priorité est l’efficacité : obtenir rapidement un premier parcours utilisable sur le site pilote, puis généraliser à partir d’un besoin réel. Il ne s’agit pas de bâtir d’emblée un CMS universel.

## 2. Compréhension validée

- Le besoin est récurrent : créer un site, puis rendre son contenu modifiable directement par un admin.
- Le site est créé en premier ou en même temps que son thème d’édition ; pas d’installation tardive d’un constructeur générique comme règle de base.
- L’interface doit être immédiate et visuelle : sélectionner le contenu dans la page, l’éditer sur place ou dans un panneau clair, voir le rendu, ajouter et ordonner des sections.
- Les sections disponibles et leurs propriétés sont définies par le thème du site. L’édition libre de styles ou de balisage qui permettrait de déformer le thème n’est pas l’usage par défaut.
- Le choix économique est explicite : GrapesJS Core, sans dépendance aux licences, limites de sessions ou domaines du Studio SDK.
- La stack d’un futur site n’est pas imposée par cette spec. Le contrat d’intégration doit être indépendant du langage du backend ; l’application garde ses fonctions métier.

## 3. Options examinées

1. **Copier l’éditeur dans chaque site** : démarrage local simple, mais correctifs et évolutions se répètent. Rejeté comme architecture cible.
2. **Kit commun GrapesJS Core, intégré par adaptateur à chaque site** : interface et moteur partagés, thème et intégration applicative propres à chaque site. Retenu pour gagner du temps sans imposer une stack backend.
3. **Imposer une stack unique à tous les sites** : socle plus simple, mais limite le choix de réalisation et n’est pas requis pour partager le moteur JavaScript et un contrat d’API.

## 4. Architecture retenue

### 4.1 Couches

- **Noyau éditeur** : GrapesJS Core, empaqueté avec l’interface d’édition Sujee, les commandes communes, l’accessibilité, l’aperçu par appareil et les interactions standard. Il ne contient pas de styles ou sections propres à un client.
- **Extension de thème** : registre versionné de composants GrapesJS et de blocs ajoutables. Elle déclare les propriétés modifiables, les règles de placement, les libellés, les aperçus, les médias requis et les classes/thèmes utilisés. Elle ne donne pas accès par défaut à l’édition arbitraire du CSS.
- **Adaptateur de site** : intégration légère, indépendante du langage backend, qui fournit les pages et projet initial, autorise/valide les lectures-écritures, gère les médias, persiste les brouillons et déclenche la publication selon les règles du site.
- **Application du site** : reste responsable des routes, données dynamiques, formulaires, comptes, SEO global et autres comportements métier. L’éditeur ne remplace pas le site ni son backend.

L’interface charge le noyau et l’extension de thème du site dans le navigateur. Le backend du site met à disposition un contrat HTTP versionné et sécurisé. Cette frontière permet de garder le même éditeur avec des backends différents ; elle ne promet pas qu’un site déjà construit pourra être converti sans adaptation.

### 4.2 Modèle de contenu et publication

Le projet GrapesJS JSON est la source de vérité éditoriale du brouillon. Il est versionné avec la version du noyau, du schéma de projet et du thème. Les données ne sont pas des templates Jinja imposés à tous les sites.

À la publication, l’adaptateur valide l’autorisation, les types de composants et les champs, puis transmet à l’application un résultat éditorial contrôlé pour validation/enregistrement atomique. Selon le moteur du site, ce résultat peut être du HTML nettoyé avec une liste blanche ou une projection structurée vers des composants/gabarits natifs. Le pilote FastAPI/Jinja mappe les composants vers ses sections typées, validées côté serveur, plutôt que de publier du HTML libre. Le CSS de thème reste fourni par le site et n’est jamais édité ni publié comme CSS libre du projet.

Les blocs qui dépendent de données ou d’actions serveur (formulaire, liste de réalisations/produits, réservation, espace membre, etc.) restent des composants déclaratifs du thème : le projet stocke une clé de composant et des propriétés validées ; l’adaptateur ou le rendu du site les associe à l’implémentation fonctionnelle. Aucun JavaScript arbitraire fourni par le projet n’est exécuté.

Le format exact du contrat (routes, enveloppes JSON, versions, réponses d’erreur et stratégie de compatibilité) est défini par l’implémentation de la première tranche et documenté avant extraction en paquet. Il doit séparer chargement, brouillon, publication, médias et état de compatibilité du thème.

### 4.3 Intégration sur le site pilote

Le site pilote utilise FastAPI/Jinja et le module `sujee_editor` existant. Celui-ci est évalué comme base de migration : conserver ce qui sert (schémas de blocs, stockage, brouillon/publication, gestion des médias et contrôles serveur), remplacer ou isoler le front maison par le noyau GrapesJS et son interface Sujee. Aucun changement de production ne fait partie de cette spec.

Les 19 sections existantes sont candidates pour le premier catalogue du thème ; elles ne sont pas toutes automatiquement considérées compatibles avec GrapesJS. Elles sont intégrées par lots, avec tests de rendu et migration de contenu. Les gabarits et comportements dont l’édition visuelle est inadaptée peuvent rester des blocs métier gérés par le site.

## 5. Expérience auteur

Le résultat visé comporte :

- une page du site rendue dans le canevas avec les vrais styles du thème ;
- sélection directe du texte ou d’une section, édition en contexte lorsque possible ;
- panneau de propriétés simple et contextualisé ;
- bibliothèque des seules sections autorisées par le thème, avec aperçu et ajout ;
- réorganisation, duplication et suppression avec confirmation si destructive ;
- gestion d’image via la médiathèque du site ;
- modes d’aperçu adaptés aux largeurs d’écran ;
- sauvegarde de brouillon avec état visible, publication distincte et reprise après erreur.

L’interface GrapesJS standard n’est pas présumée satisfaire la barre UX. Le noyau reste GrapesJS Core, mais les panneaux et la navigation peuvent être remplacés ou masqués au profit d’une coque plus intuitive. Le comportement exact est validé par un prototype utilisable sur le site pilote avant extension du catalogue.

## 6. Sécurité, intégrité et compatibilité

- Toute lecture/écriture est autorisée côté serveur. Une session d’administration valide est exigée ; CSRF, vérification Origin, limitation d’accès et `noindex` suivent le modèle de sécurité du site hôte.
- Le backend valide le JSON de projet, la version du schéma, les identifiants de composant connus, les valeurs de champs et les références d’assets. Le navigateur ne fait jamais autorité.
- Le HTML de publication est nettoyé côté serveur avec une liste blanche ; CSS, scripts et gestionnaires d’événement arbitraires sont refusés.
- Brouillon et publié sont distincts. La publication est atomique ; un échec laisse le contenu public précédent intact. Les révisions/restaurations existantes sont conservées ou remplacées par une capacité équivalente avant migration.
- Les projets ont des versions explicites noyau/thème/schéma. Une incompatibilité bloque l’édition avec un message actionnable ; une migration explicite doit précéder toute conversion destructive.
- L’éditeur ne change jamais le contenu public si le client n’a pas validé et publié ses modifications.

## 7. Maintenance GrapesJS et compatibilité des projets

- GrapesJS Core, les plugins et les outils de build sont épinglés à des versions exactes dans le lockfile ; aucun upgrade automatique n’est fusionné sans revue.
- Les mises à jour de dépendances sont proposées par PR automatisées et exécutent build, tests, contrôle licence/sécurité et tests de compatibilité avec des projets déjà enregistrés.
- Avant une mise à jour, lire les notes de version et migration officielles, vérifier l’impact sur les composants/thèmes, puis valider dans une recette.
- Le JSON GrapesJS et le schéma des composants sont versionnés. Toute mise à niveau qui change le format ajoute une migration ou un lecteur rétrocompatible avant d’être déployée ; prévoir retour arrière.
- Une mise à jour GrapesJS ne déclenche pas à elle seule un déploiement de site.

## 8. Hors périmètre de la première tranche

- Un éditeur générique d’HTML/CSS ou un concurrent complet de Webflow.
- Le Studio SDK, services de stockage/édition hébergés ou licences par domaine.
- Un nouveau CMS/backend commun à tous les sites.
- L’extraction et publication immédiates d’un paquet public versionné avant preuve sur le site pilote.
- Les fonctionnalités métier (boutique, réservation, espace client, gestion de catalogue) dans GrapesJS.
- Une refonte graphique du site spécifiée sans brief de DA distinct. Cette spec concerne l’écosystème d’édition, pas le design final des pages.

## 9. Phasage proposé

1. **Prototype vertical sur le site pilote** : intégrer GrapesJS Core dans une page d’administration de recette, avec interface simple, vrai CSS, trois types de sections représentatifs, édition titre/texte/image, ajout/réorganisation, sauvegarde brouillon et reprise après rechargement. Vérifier rendu public et sécurité avant d’étendre.
2. **Consolidation du contrat** : transformer les besoins prouvés en interface d’adaptateur versionnée ; traiter les erreurs, permissions, assets, publication, compatibilité et export contrôlé ; couvrir par tests automatisés et navigateur.
3. **Portage progressif du thème pilote** : intégrer les sections une par une et migrer le contenu sans perte ; maintenir l’ancien mode tant qu’une section n’a pas son équivalent vérifié.
4. **Extraction et starter réutilisable** : publier le noyau interne et la documentation d’intégration après validation par un deuxième site ou une intégration représentative. Ne pas extraire une abstraction spéculative.

Chaque phase reste isolée de la production jusqu’à validation explicite et vérifications de recette. Une mise en production nécessite une procédure et une validation distinctes.

## 10. Critères de réussite

- Sur le site pilote, un auteur peut choisir une section de la page, modifier titre/texte/image, ajouter et réordonner une section, puis voir le résultat exact après publication.
- Le parcours est compréhensible sans connaître GrapesJS ; une courte observation utilisateur confirme qu’un auteur retrouve facilement l’ajout d’une section et l’édition d’un texte.
- Les changements de contenu ne peuvent pas introduire une police, couleur, espacement, CSS ou script libre qui casse le thème.
- Le visiteur non connecté ne voit jamais un brouillon ; les tests couvrent l’accès direct par URL et l’API.
- Après sauvegarde/rechargement, les données éditoriales restent fidèles ; en cas d’échec de publication, le rendu public précédent reste intact.
- Les fonctions dynamiques du site continuent de fonctionner et ne sont pas transformées en HTML statique inopérant.
- Un site suivant peut réutiliser noyau et contrat avec un thème/adaptateur spécifique, sans copier le moteur ni modifier le noyau.
- Les coûts de runtime n’incluent pas une licence ou un service hébergé du Studio SDK.

## 11. Points à valider dans le plan, sans bloquer la spec

- Version GrapesJS Core et outils de build exacts retenus au démarrage, après vérification de la version stable et de sa licence.
- Format exact de sérialisation, publication et nettoyage ; le prototype doit comparer le projet JSON, le rendu publié et l’affichage réel.
- Choix de la coque UI et des composants réellement inclus par défaut ; le critère est la simplicité observée, pas la fidélité aux panneaux stock.
- Condition de validation pour extraire le kit : deuxième site réel ou adaptateur de démonstration suffisamment représentatif.
