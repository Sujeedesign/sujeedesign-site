# Admin pages piloté par GrapesJS — bascule complète

Date : 20 octobre 2026

Statut : brouillon de spécification, en attente de revue utilisateur

Projet : `Sujeedesign/sujeedesign-site`

## 1. Objectif

Faire de GrapesJS l’unique interface de modification du contenu des pages de `sujeedesign.com`. Retirer l’ancien éditeur de sections pour éviter que les mêmes pages soient éditables par deux interfaces. La bascule n’a lieu qu’après prise en charge et validation des 19 types de sections existants.

Conserver le reste du back-office et ses fonctions : liste et gestion des pages, médias, messages, réglages, redirections, sauvegardes et historique. Le rendu public reste produit par les gabarits Jinja et les sections typées du site.

## 2. Compréhension validée

- L’objectif immédiat est une expérience d’édition de pages unique et plus simple, centrée sur GrapesJS.
- L’ancien éditeur de sections doit disparaître après une migration complète des capacités, pas avant.
- Les modules opérationnels de l’admin ne sont pas remplacés par GrapesJS.
- Les modifications de page et les réglages SEO ne doivent pas exister dans deux écrans concurrents. Les réglages de page sont regroupés dans une zone « Paramètres » de l’éditeur visuel.
- Le catalogue actuel contient 19 types de sections. Le pilote GrapesJS en couvre actuellement 3 ; les 16 autres doivent être ajoutés avant le cutover.
- Aucun contenu public ne doit être modifié par la migration ou l’ouverture de l’éditeur. La publication explicite reste le seul moyen de modifier le rendu public.

## 3. Options examinées

1. **Étendre GrapesJS aux 19 types, puis couper l’ancien éditeur** — retenu. La bascule est plus longue mais retire réellement le doublon sans rendre des sections inaccessibles.
2. **Basculer immédiatement avec l’ancien éditeur en secours** — rejeté comme état final : il maintiendrait deux chemins d’édition et une ambiguïté pour l’utilisateur.
3. **Reconstruire tout le back-office dans GrapesJS** — hors périmètre. GrapesJS est l’éditeur de page, pas le remplacement des modules de messages, médias, réglages et sauvegarde.

## 4. Architecture retenue

### 4.1 Écrans et navigation

- `/admin/pages` reste la liste et l’entrée de gestion des pages. Ouvrir une page mène à GrapesJS, non à l’ancien formulaire de sections.
- `/admin/pages/{id}` devient l’entrée canonique de l’éditeur visuel.
- `/admin/visual/{id}` reste temporairement un alias redirigeant vers l’entrée canonique, afin de préserver les liens existants.
- Le formulaire classique qui expose les champs de section, leur ordre et leur contenu n’est plus rendu ni accessible depuis l’interface. Les anciennes API de section ne sont pas supprimées sans preuve qu’aucun autre flux ne les utilise ; elles peuvent être conservées en interne pendant la transition.
- Création, suppression, aperçu et état de publication des pages restent disponibles dans le module Pages. Après création, l’utilisateur peut ouvrir directement la nouvelle page dans GrapesJS.
- Les modules Médias, Messages, Réglages, Redirections et Sauvegarde restent dans la navigation et conservent leurs comportements.

### 4.2 Une seule interface pour le contenu et les métadonnées

L’éditeur GrapesJS contient :

- le canevas de la page et les sections du thème ;
- une palette de sections disponibles ;
- un panneau contextuel pour les champs de la section sélectionnée ;
- une zone « Paramètres de page » pour les métadonnées actuellement modifiables depuis l’ancien formulaire (titre, slug, type, accroche, couverture, client et champs associés, visibilité au menu, ordre, SEO et indexation) ;
- des commandes visibles Enregistrer, Aperçu et Publier, avec un état de sauvegarde et les conflits affichés clairement.

Le changement de slug conserve le comportement actuel de redirection. Les opérations destructrices (suppression de page ou section) demandent confirmation. Les actions de publication et de restauration restent distinctes de l’enregistrement de brouillon.

### 4.3 Catalogue GrapesJS du thème Sujee

- Ajouter des composants et blocs typés pour les 19 types enregistrés dans `sujee_editor.blocks.DEFAULT_BLOCKS` : `banniere`, `bloc-liens`, `chapter`, `chiffres-cles`, `citation`, `cta-final`, `etude-de-cas`, `faq`, `formulaire-contact`, `galerie`, `hero`, `image-pleine-largeur`, `logos-clients`, `manifeste`, `marquee`, `process`, `realisations-grid`, `services-list`, `texte-riche`.
- Déclarer les composants de thème et leurs Traits depuis le registre de blocs serveur, ou depuis un manifeste versionné généré à partir de ce registre. Éviter une seconde définition divergente des champs côté navigateur.
- Préserver les variantes, valeurs par défaut, visibilités, références de médias, listes et ordre des champs. Les blocs dynamiques (formulaire, listes de réalisations/services, etc.) restent des composants déclaratifs, liés au rendu métier existant, et ne deviennent jamais du HTML statique.
- N’autoriser que les composants, attributs et propriétés explicitement enregistrés. Aucun Style Manager libre, JavaScript arbitraire, CSS libre ou composant HTML générique publié.
- Les types inconnus ou les données non représentables échouent avec une erreur explicite ; ne jamais omettre ou convertir silencieusement une section.

### 4.4 Données, sauvegarde et publication

- Le projet GrapesJS versionné constitue le brouillon de l’interface unique.
- À la publication, l’adaptateur valide le projet puis le convertit en sections typées pour les gabarits Jinja existants. La table `sections` demeure la projection publiée consommée par le rendu public ; GrapesJS ne publie pas directement son HTML/CSS.
- La conversion et l’écriture de la page publiée sont atomiques. Un échec laisse la version publique intacte et le brouillon disponible.
- Le projet publié, les révisions et les restaurations gardent une relation déterministe : restaurer une révision met à jour le contenu publié et la base de projet selon le contrat défini, sans perdre le brouillon courant sans avertissement.
- Avant toute conversion d’un projet déjà enregistré, ajouter un lecteur rétrocompatible ou une migration versionnée du projet pilote (thème v1) vers le catalogue complet. Une migration ne s’écrit qu’après validation complète ; un projet incompatible reste intact et est signalé.
- La sauvegarde/export existante continue d’inclure les données nécessaires à restaurer sections, projets GrapesJS et révisions.

### 4.5 Rendu public et sécurité

- Le site public continue d’utiliser FastAPI/Jinja, ses templates et ses composants dynamiques. Aucun changement de moteur de rendu public n’est prévu.
- Les routes de l’éditeur exigent la session admin existante. Les écritures vérifient CSRF, Origin, taille, version attendue, schéma et identifiants de composants côté serveur.
- Le rendu public ne lit jamais un brouillon. L’échec de validation, la perte de session ou un conflit de version ne publient rien.
- Les textes riches et références de médias suivent les validateurs et listes blanches existants. Les scripts, attributs événementiels, URL `javascript:`, styles libres et composants non autorisés sont refusés ou nettoyés comme prévu par le contrat du thème.

## 5. Migration et stratégie de bascule

1. Étendre les tests d’import et d’aller-retour pour chacun des 19 types. Couvrir les variantes, champs imbriqués, répétitions, médias et comportements dynamiques.
2. Ajouter au thème GrapesJS un composant testable par type et valider les projets v1 existants sans réécriture silencieuse.
3. Parcourir les pages déjà stockées sur une copie de recette et vérifier que toutes leurs sections sont représentables. Les contenus atypiques bloquent la bascule jusqu’à correction ou prise en charge explicite.
4. Garder l’écran classique disponible uniquement dans l’environnement de développement/recette pendant cette phase, pas comme chemin de modification de production une fois la bascule faite.
5. Après les critères de recette, faire de GrapesJS l’unique écran d’édition dans `/admin/pages/{id}` et retirer l’accès UI à l’ancien formulaire de sections. Conserver un retour arrière de code et une sauvegarde complète avant déploiement.
6. N’effectuer aucun changement de contenu de production pendant le déploiement. La bascule de code en production requiert validation de recette et accord explicite de déploiement.

## 6. Critères d’acceptation

### Fonctionnels

- Depuis la liste Pages, l’édition ouvre GrapesJS et il n’existe plus de bouton parallèle vers l’ancien éditeur de sections.
- Les 19 types peuvent être chargés, édités, ajoutés, réordonnés, sauvegardés, rechargés et publiés selon leur schéma.
- Les champs page/SEO existants restent modifiables dans le panneau Paramètres de GrapesJS.
- Les modules Médias, Messages, Réglages, Redirections et Sauvegarde restent accessibles et fonctionnels.
- Après publication, la page est rendue par ses templates Jinja habituels ; les comportements dynamiques restent actifs.
- Une révision restaurée conserve un état cohérent entre projet visuel, sections et rendu public.

### Intégrité et sécurité

- Tests aller-retour pour chacun des 19 types et des pages contenant plusieurs types/variantes.
- Tests de conversion v1 → version complète, migration idempotente, données invalides et absence de perte sur échec.
- Tests auth, CSRF, Origin, contrôle de taille, composants inconnus, conflits de version, nettoyage rich text, et invisibilité des brouillons pour les visiteurs.
- Les sections inconnues ou non représentables ne sont ni abandonnées ni publiées partiellement.

### Interface et exploitation

- Tests Playwright couvrant navigation, réglages page, insertion de blocs, édition des champs, images, réorganisation, sauvegarde/rechargement, publication, restauration et erreurs.
- Vérification des vues à 375, 768 et 1280 px, clavier/focus, labels accessibles et retour d’état des actions.
- Recette sur une copie isolée du contenu, build frontend et image Docker reproductibles, puis vérification du rendu publié.
- Aucun déploiement de production avant réussite de la suite et validation distincte de la recette.

## 7. Hors périmètre

- Remplacer ou refaire les modules Messages, Médias, Réglages, Redirections et Sauvegarde.
- Remplacer FastAPI/Jinja ou publier HTML/CSS GrapesJS directement.
- Ajouter l’édition libre de mise en page, de CSS ou de JavaScript.
- Modifier le contenu réel en production pendant la migration.
- Déployer cette évolution en production sans recette complète et autorisation explicite.

## 8. Risques et parades

| Risque | Parade |
|---|---|
| Une section historique ne se convertit pas | Catalogue complet avant cutover, scan de recette, erreur bloquante non destructive |
| GrapesJS remplace involontairement la logique d’un bloc dynamique | Composants déclaratifs typés et tests du rendu Jinja existant |
| Perte de brouillon lors d’une migration de schéma | Versionnement, migration sans écriture avant validation et fixture de projets v1 |
| Métadonnées encore éditées dans deux écrans | Les intégrer au panneau Paramètres de GrapesJS avant de retirer l’écran classique |
| Régression de publication ou restauration | Tests transactionnels, révisions existantes conservées, recette sur copie |
| Changement de route casse des liens enregistrés | Garder `/admin/visual/{id}` en redirection vers l’entrée canonique |

## 9. Questions de conception laissées à l’implémentation

- Disposition exacte du panneau « Paramètres de page » et des vues responsive, évaluée sur l’éditeur existant plutôt que par une refonte graphique indépendante.
- Si le catalogue de blocs doit être généré côté serveur ou maintenu par un manifeste compilé ; dans les deux cas, le registre de blocs demeure la source de vérité.
- La version exacte du thème et la migration de projets v1, à fixer dans le plan en conservant l’épinglage GrapesJS actuel.
- Le mode d’ouverture de l’aperçu authentifié, tant qu’il ne crée pas de second chemin d’édition.
