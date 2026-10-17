# Audit SEO éditorial et technique

Date : 17 octobre 2026. Périmètre documentaire : `seed/content.json`, spécification du site, anciens fichiers HTML consultés et profils Behance / LinkedIn accessibles publiquement. Ce rapport n'est pas un crawl de production.

## Résumé

Le projet part d'une base saine : URLs propres prévues, rendu serveur, redirections 301 listées, pages de services et d'études de cas individualisées, contenus éditoriaux substantiels et stratégie de données structurées inscrite dans la spec. Les améliorations les plus urgentes sont éditoriales : compléter les introductions vides des deux listes, réparer une tournure fautive, calibrer les accroches pour éviter les promesses implicites et compléter les textes alternatifs des images.

## État des lieux : points solides

- Architecture prévue favorable à l'indexation : FastAPI/Jinja2, rendu HTML côté serveur et ressources sitemap/robots mentionnées dans la spec (`docs/superpowers/specs/2026-10-17-site-cms-design.md`, lignes 33-45).
- Les URLs canoniques sans extension et des redirections 301 depuis les anciens chemins sont décidées. La liste inclut accueil, listes, services et projets (spec, lignes 24 et 187-202; `seed/content.json`, lignes 1394-1465).
- Chaque fiche service contient une accroche, une explication, une réponse et des éléments livrables. Exemples : identité, `seed/content.json`, lignes 429-441 et 454-487; web, lignes 685-697 et 732-743.
- Les fiches projets précisent mission, approche, année et domaine. Exemple Vaasam : `seed/content.json`, lignes 1073-1102. Le ton à la première personne et l'adresse au client sont cohérents avec la demande.
- La page 404 est explicitement déclarée `noindex,nofollow` dans le seed (lignes 389-394). La spec prévoit Person/ProfessionalService, Service, CreativeWork, BreadcrumbList et FAQPage lorsqu'une FAQ existe (lignes 129-137).
- Références publiques consultées : le profil Behance indique « Available for Freelance », directeur artistique et activité freelance depuis 2013; LinkedIn via le résultat de recherche décrit une activité print et digitale, direction artistique, conseil et stratégie. Le profil LinkedIn n'a pas pu être extrait directement (403), son extrait de recherche n'est pas une validation indépendante des dates et affirmations du site.

## Problèmes constatés et preuves

1. Les listes manquent d'introduction descriptive. Dans `seed/content.json`, page `realisations`, section hero, `intro` est vide (lignes 138-145); page `services`, `intro` est vide (lignes 169-176). Une grille seule peut laisser le contexte et l'orientation utilisateur implicites.
2. Formulation incorrecte dans les intitulés des prestations. L'accueil, section `services-list`, `title` contient « Tout ce qu'une marque<br>peut avoir besoin de. » (`seed/content.json`, lignes 88-94). Même tournure dans le titre hero de la page services (lignes 169-176).
3. H1 d'accueil peu explicite pour le métier. Le rotator propose « Sujee, / Design ta marque / de A à Z. » (`seed/content.json`, lignes 23-30). La promesse de marque est identifiable, mais les métiers, la localisation et les publics ne sont pas dans ce texte visible.
4. Champs SEO absents dans plusieurs entrées du seed, notamment les listes `realisations` et `services` (aucun `seo_title` / `seo_description` entre leurs objets des lignes 130-185). Les métadonnées proposées comblent cette lacune pour les pages livrées.
5. Alt de couverture vide sur les quatre réalisations : `cover_alt: ""` pour Vaasam (lignes 1055-1061), RFA (1128-1134), projet IA (1201-1207) et formation (1275-1281). Il faut rédiger des alternatives qui décrivent l'image finale effectivement chargée, non un visuel supposé.
6. Incohérence de dates à arbitrer : la page À propos affiche « Depuis 2011 » dans `meta` mais l'introduction et plusieurs éléments parlent d'activité indépendante depuis 2013 (`seed/content.json`, lignes 203-210 et 227); le profil LinkedIn indexé indique une expérience depuis septembre 2011, Behance indique freelance depuis 2013. Clarifier la date de début selon le sens (carrière / indépendant).
7. Le projet `solutions-ia-automations` est une réalisation du studio (« Programme studio » dans son bloc de métadonnées, lignes 1246-1249), pas une preuve de résultats chez un client. Les titres et descriptions doivent le présenter comme démonstration interne et éviter des gains chiffrés ou une réussite client non documentée.
8. La page contact affirme « réponse personnelle sous 24h ouvrées » (`seed/content.json`, lignes 342-345) et « délais ... tenus » (lignes 367-369). À conserver seulement si ces engagements sont réellement tenables.
9. Les mentions légales signalent elles-mêmes des champs à compléter : SIRET, adresse de l'établissement et hébergeur (`seed/content.json`, lignes 1374-1379). L'exactitude de la forme juridique, des informations éditeur, du traitement des données et des cookies doit être confirmée par Sujee. Les mentions ne font pas partie des 15 pages SEO demandées mais restent une priorité de publication.
10. Les anciennes pages HTML consultées utilisent des liens relatifs `.html` et n'affichent pas partout un lien visible vers les mentions dans le pied de page (exemple `deploy/index.html`, lignes 222-242; `deploy/identite.html`, lignes 184-204). Le nouveau gabarit doit fournir des liens internes cohérents, et les redirections spécifiées doivent être testées.
11. Aucune donnée de volume de recherche n'a été collectée. Les niveaux ci-dessous sont des estimations qualitatives d'intention, pas des volumes mensuels ni une étude de mots-clés.

## Métadonnées proposées

Le fichier `metadonnees.json` fournit une entrée par page du périmètre : accueil, realisations, services, a-propos, contact, 404, cinq services et quatre réalisations. Les titles et descriptions sont à intégrer dans les champs SEO de la CMS. Les pages liste, détail et contact doivent toutes avoir un canonical absolu vers leur URL publique finale. La 404 doit rester non indexable et renvoyer un vrai statut HTTP 404.

## Priorités d'action

| Priorité | Action | Impact attendu | Effort | Risque |
|---|---|---|---|---|
| P0 | Compléter SIRET, adresse et hébergeur; valider mentions légales et promesses de contact | Confiance, conformité et qualité des informations locales | Faible à moyen | Élevé si publié incomplet ou inexact |
| P1 | Ajouter les introductions de `/realisations` et `/services`; corriger la tournure de titre | Meilleure compréhension de l'offre et couverture lexicale utile | Faible | Faible |
| P1 | Définir titles, descriptions, canonical, robots et OG uniques pour les 15 pages | Présentation dans les résultats et cohérence d'indexation | Faible | Faible |
| P1 | Renseigner les alt des images et vérifier noms, dimensions, poids et visibilité | Accessibilité et compréhension des médias | Moyen | Faible |
| P1 | Contrôler les 301 une à une et éviter les chaînes / boucles; comparer sitemap aux pages publiées | Continuité des URLs et découverte des pages | Moyen | Moyen |
| P2 | Ajouter le maillage contextuel service ↔ projet et breadcrumbs | Découverte, contexte et navigation vers les contenus proches | Moyen | Faible |
| P2 | Valider les données structurées avec les URLs, coordonnées et contenus réels | Éligibilité à certains résultats enrichis, sans garantie d'affichage | Moyen | Moyen |
| P2 | Revoir les formulations potentiellement promissives (« vendeur », délai de réponse, temps gagné) | Crédibilité et réduction des attentes non garanties | Faible | Moyen |
| P3 | Après lancement, surveiller Search Console, requêtes, pages indexées et parcours de contact | Mesure des effets réels et ajustement du contenu | Récurrent | Faible |

## Maillage interne proposé

Ancrages descriptifs, intégrés dans le texte ou les blocs de projets. Pas de liens répétés artificiellement. Les liens ci-dessous sont à ajouter aux pages sources si le composant automatique ne les crée pas déjà.

| Page source | Destination | Ancre suggérée | Contexte |
|---|---|---|---|
| `/` | `/services/identite` | identité de marque | Présentation des prestations |
| `/` | `/services/creation-visuelle` | création visuelle et PAO | Liste des services |
| `/` | `/services/web` | création de site web et e-commerce | Liste des services |
| `/` | `/services/marketing` | conseil marketing et communication | Liste des services |
| `/` | `/services/ia` | automatisation et solutions IA | Liste des services |
| `/` | `/realisations/vaasam-paris` | identité de marque de Vaasam Paris | Carte projet associée à l'identité |
| `/` | `/realisations/resto-franchise-africain` | identité visuelle pour un réseau de restauration | Carte projet associée à la marque |
| `/services/identite` | `/realisations/vaasam-paris` | identité de marque de Vaasam Paris | Exemple détaillé, catégorie et mission attestées |
| `/services/identite` | `/realisations/resto-franchise-africain` | système d'identité pour une franchise | Exemple pertinent de déclinaisons |
| `/services/creation-visuelle` | `/realisations/vaasam-paris` | déclinaisons de l'identité Vaasam Paris | Lien si les supports montrés sont bien disponibles |
| `/services/creation-visuelle` | `/realisations/resto-franchise-africain` | supports de marque pour un réseau de restauration | Menus, enseignes et gabarits mentionnés dans la mission |
| `/services/web` | `/realisations/vaasam-paris` | projet Vaasam Paris | À proposer uniquement si la page présente un livrable web vérifié; sinon ne pas lier comme exemple de site |
| `/services/marketing` | `/realisations/vaasam-paris` | stratégie de marque de Vaasam Paris | Approche / positionnement présents dans le cas, sans attribuer de résultats marketing |
| `/services/ia` | `/realisations/solutions-ia-automations` | workflows et automatisations IA du studio | Signaler clairement qu'il s'agit d'un programme interne |
| `/services/creation-visuelle` | `/realisations/formation-ui-ux-pao` | supports pédagogiques UI/UX et PAO | Exemple de conception de supports |
| `/a-propos` | `/realisations/formation-ui-ux-pao` | supports de formation UI/UX et PAO | Relier l'expérience de formation à un cas concret |
| Fiches de service | `/services` | tous les services de Sujee Design | Retour vers la liste; en complément des liens vers services voisins |
| Fiches de réalisation | `/realisations` | toutes les réalisations | Retour vers la liste et breadcrumb |
| Pages de conversion | `/contact` | parler de votre projet | CTA explicite, sans ancre générique répétée |

Note : le bloc `realisations-grid` auto du seed ne documente pas ici le filtre de pertinence par service. Vérifier l'ordre et les liens réellement rendus; ne pas présenter les quatre réalisations comme preuves pour chaque prestation si le lien n'est pas justifié.

## Mots-clés prioritaires et demande qualitative

Les niveaux sont des estimations qualitatives relatives, déduites du caractère générique ou spécialisé des requêtes en français. Aucun outil de volumes, pays, période ou tendance n'a été consulté; elles ne doivent pas être interprétées comme des volumes chiffrés. Cibler principalement une intention, avec variantes naturelles et contexte Paris / Île-de-France si pertinent.

| Service | Requête principale | Variantes / longue traîne | Demande estimée qualitativement |
|---|---|---|---|
| Identité | identité de marque | création identité visuelle, branding, logo professionnel, identité visuelle entreprise Paris | Moyenne à élevée, requête concurrentielle et intention commerciale claire |
| Création visuelle | création graphique / création visuelle | graphiste freelance Paris, création de flyer, brochure, menu restaurant, PAO | Élevée pour les termes génériques, plus ciblée pour les supports et secteurs |
| Web | création site web | création site internet Paris, site vitrine, création boutique en ligne, webdesign | Élevée et concurrentielle; segmenter par format et public |
| Marketing | conseil en communication | stratégie de communication, conseil marketing TPE PME, création de contenus | Moyenne, intention plus large; préciser l'accompagnement concret |
| IA | automatisation IA | automatisation tâches entreprise, workflow IA, intégration IA TPE PME, agent IA métier | En croissance mais très variable; préciser tâches et usages réels, éviter les promesses de gains |

## Données structurées page par page

À produire en JSON-LD cohérent avec les données affichées. Utiliser des URL absolues `https://sujeedesign.com/...`, identifiants `@id` stables, données visibles et validées. Ne pas publier d'adresse, de note, d'avis ou de prix non confirmés.

| Page | Types à envisager | Remarques |
|---|---|---|
| `/` | `WebSite`, `Person`, `ProfessionalService` | Relier la marque à Sujeepan Sabesan; nom, description, logo, URL, ville et liens de profils vérifiés. Éviter de dupliquer la même entité de façon contradictoire. |
| `/realisations` | `CollectionPage`, `BreadcrumbList` | Les éléments de collection doivent correspondre aux projets effectivement affichés. |
| `/services` | `CollectionPage`, `BreadcrumbList` | Liste des prestations avec URL et noms des fiches. |
| `/a-propos` | `AboutPage`, `Person`, `BreadcrumbList` | Parcours et dates à arbitrer avant balisage. |
| `/contact` | `ContactPage`, `ProfessionalService`, `BreadcrumbList` | Email et zone de service confirmés; ne pas inventer adresse physique ou horaires. |
| 404 | aucun balisage de contenu, éventuellement `WebPage` minimal | HTTP 404, `noindex`; ne pas exposer la page comme page d'offre indexable. |
| `/services/identite` | `Service`, `BreadcrumbList` | Service, fournisseur, zone de service, URL et nom exacts. |
| `/services/creation-visuelle` | `Service`, `BreadcrumbList` | Idem. |
| `/services/web` | `Service`, `BreadcrumbList` | Idem; ne baliser ni prix ni disponibilité sans source confirmée. |
| `/services/marketing` | `Service`, `BreadcrumbList` | Idem. |
| `/services/ia` | `Service`, `BreadcrumbList` | Idem; décrire des prestations réelles, sans promesse de performance. |
| `/realisations/vaasam-paris` | `CreativeWork` ou `VisualArtwork`, `BreadcrumbList` | `CreativeWork` est le choix prudent; auteur et date uniquement selon l'attribution validée. Pas de résultats inventés. |
| `/realisations/resto-franchise-africain` | `CreativeWork`, `BreadcrumbList` | Projet d'identité et de déclinaisons, année 2026 selon le seed. |
| `/realisations/solutions-ia-automations` | `CreativeWork`, `BreadcrumbList` | Qualifier explicitement de programme studio, ne pas décrire comme cas client. |
| `/realisations/formation-ui-ux-pao` | `CreativeWork`, `BreadcrumbList` | Projet de supports/cursus; ne pas utiliser `Course` sans offre de cours dédiée et détails correspondants. |

La spec mentionne `FAQPage` uniquement là où une FAQ est publiée. Aucune FAQ n'est présente dans les pages du périmètre consultées; ne pas en générer pour chercher un résultat enrichi. Tester le JSON-LD après intégration et corriger les avertissements, sans considérer la validation comme garantie d'affichage.

## Vérifications humaines indispensables

- SIRET, dénomination exacte, statut / forme d'exercice et adresse de l'établissement, à confirmer par Sujee.
- Mentions légales : identité de l'éditeur, directeur de publication si applicable, coordonnées, hébergeur et adresse de l'hébergeur. Le seed indique que SIRET, adresse et hébergeur restent à compléter; ils n'ont pas été vérifiés ici.
- Données personnelles : finalités, durée de conservation, base légale, destinataire, droits et procédure de contact, à confirmer avec le fonctionnement réel du formulaire et les notifications.
- Cookies / mesure d'audience : le seed affirme l'absence de cookies de mesure et de publicité. Cette affirmation doit être comparée aux scripts, outils tiers et en-têtes réellement déployés; aucune inspection de production n'a été réalisée.
- Claims éditoriaux : date « depuis 2011 » versus indépendant depuis 2013, réponse sous 24 h ouvrées, engagements de délai, références clients et périmètre des réalisations. Validation de Sujee avant publication.
- Images des projets : droits d'utilisation, confidentialité, accord client, crédits et texte alternatif correspondant au fichier image effectivement affiché.

## Limites de vérification

- Je n'ai pas consulté la propriété Google Search Console, Analytics 4, Tag Manager ou PageSpeed Insights. Aucun chiffre de trafic, d'indexation, de performance ou de conversion n'est présenté.
- Je n'ai pas exécuté de crawl HTTP du domaine en production, ni vérifié les réponses, canoniques, balises réellement rendues, sitemap, robots, redirections, headers ou statut de la 404. La spec décrit le comportement prévu, pas un résultat de test.
- Les fichiers HTML anciens indexés ont été consultés pour l'accueil et certaines fiches service; le reste de l'ancien site n'a pas été contrôlé page par page dans ce rapport.
- Behance a été extrait; LinkedIn direct a répondu 403. Les résultats de recherche et la spec constituent des références, pas une preuve de propriété ou de véracité des données légales.
- Les volumes de mots-clés ne sont pas disponibles sans source de recherche. Les niveaux sont qualitatifs, explicitement estimatifs.
