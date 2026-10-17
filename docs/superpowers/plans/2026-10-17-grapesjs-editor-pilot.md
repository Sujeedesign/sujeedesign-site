# Plan d’implémentation : prototype GrapesJS Core sur le site pilote

> **Pour l’exécution par agent :** suivre les tâches dans l’ordre et appliquer le TDD sur chaque changement testable. Ne pas déployer en production sans demande explicite distincte.

**Objectif :** éprouver un éditeur visuel plus simple sur un environnement de recette du site pilote, avec GrapesJS Core auto-hébergé, trois sections du thème, modification titre/texte/image, ajout et réorganisation, sauvegarde de brouillon/rechargement et publication qui conserve le rendu réel du site.

**Architecture :** GrapesJS Core est le moteur navigateur. Le module `sujee_editor` porte le montage GrapesJS et ses composants de base ; le thème du site fournit une extension avec les sections autorisées. Un contrat d’API REST authentifié conserve les projets GrapesJS JSON en brouillon. Un adaptateur du thème traduit les composants autorisés vers le modèle de sections déjà consommé par FastAPI/Jinja à la publication. Le site public continue à rendre ses gabarits Jinja et ses fonctions métier. Aucun HTML, CSS ou JavaScript arbitraire provenant de l’éditeur ne devient public. Le prototype reste isolé de la production et l’ancien éditeur demeure disponible pendant l’évaluation.

**Spécification :** `docs/superpowers/specs/2026-10-17-grapesjs-ecosystem-design.md`

**Contexte du dépôt vérifié :** Python 3.13/FastAPI/Jinja/SQLite, pas de package frontend Node existant à la racine ; Node v26 et npm v11 disponibles dans l’environnement de travail. Le Dockerfile de production est actuellement Python seul. `sujee_editor` expose déjà ses routes et son stockage de sections, son schéma comporte 19 blocs et les écritures utilisent session, CSRF, contrôle Origin et version optimiste. Le dépôt a 391 tests collectés au moment de la rédaction. Le plan prévoit une construction locale du bundle et devra vérifier qu’elle fonctionne aussi dans le build Docker.

## Contraintes globales

- Vérifier la version GrapesJS Core et la licence réelle du paquet avant de la pinner ; fixer les versions dans `package.json` et `package-lock.json`. Ne pas inclure Studio SDK ni requête CDN/runtime externe.
- Servir le JS et le CSS construits depuis les assets du site. Construire le frontend dans un build reproductible, inclus dans l’image de recette et de production via une étape dédiée ; pas de dépendance à un build manuel oublié.
- Protéger la page et les API d’édition avec la session existante, CSRF et contrôle Origin. Un visiteur ou une session expirée ne reçoit ni brouillon ni projet d’édition.
- Valider côté serveur la forme du projet, les types de composants admis, les champs, la taille JSON, les versions et les références de médias. Le client n’est jamais autoritaire.
- Pas d’édition arbitraire de CSS, de scripts, de styles inline ou de blocs HTML génériques. L’export GrapesJS n’est pas publié directement ; le rendu public passe par les composants et gabarits connus du site.
- Garder les changements derrière une URL d’administration de recette. Ne pas remplacer l’éditeur actif ni supprimer son code dans ce prototype.
- Ne pas toucher à la prod, ses données ou ses médias. Garder les fichiers de recette et probes temporaires hors du dépôt et hors de `/tmp`, sous `/opt/data/profiles/raj/cache/scratch`.

## Tâche 1 : épingler GrapesJS Core et démontrer le modèle de composant

**Fichiers :**
- Créer `sujee_editor/editor/frontend/package.json`, `package-lock.json`, `vite.config.js`, `src/main.js`, `src/theme-plugin.js`.
- Créer `tests/test_editor_frontend_build.py` ou ajouter des assertions ciblées aux tests bootstrap existants.
- Ajouter le point d’entrée des commandes frontend à la documentation développeur concernée, après repérage du document.

**Étapes :**

1. Écrire un test de build qui vérifie l’existence des assets compilés attendus et l’absence de référence runtime à un CDN. Il doit échouer avant création de la configuration.
2. Vérifier le paquet et sa licence depuis le registre npm et le dépôt officiel ; pinner une version stable exacte de `grapesjs` et le bundler nécessaire, puis générer le lockfile.
3. Créer un build Vite déterministe qui sort dans `sujee_editor/editor/static/vendor/` ou dans un répertoire de sortie équivalent servi par l’application. La sortie contient le bundle GrapesJS et son CSS sous des noms stables ou fingerprintés avec manifeste.
4. Écrire un plugin GrapesJS minimal qui enregistre un composant typé sans Style Manager libre, un bloc d’insertion de ce composant, et des traits représentant uniquement des propriétés autorisées.
5. Vérifier avec un test navigateur/smoke script que le composant est insérable, sélectionnable, sérialisé en project JSON et restauré à l’identique après `loadProjectData`/`store`.
6. Exécuter `npm ci && npm run build` dans le sous-répertoire frontend, puis `.venv/bin/python -m pytest -q tests/test_editor_frontend_build.py`.
7. Vérifier que les assets de build ne modifient pas le rendu public lorsqu’ils ne sont pas montés.

**Commit :** `build(editor): add self-hosted GrapesJS Core frontend`

## Tâche 2 : contrat de thème et adaptateur de conversion du site pilote

**Fichiers :**
- Créer `sujee_editor/editor/theme.py` (ou module équivalent de registre/version), `sujee_editor/editor/project.py` et `tests/test_editor_project.py`.
- Réutiliser `sujee_editor/blocks/catalogue.py` et `blocks/validate.py` comme source du schéma ; ne pas dupliquer les règles de champs dans le frontend.

**Étapes :**

1. Écrire des tests sur les trois composants sélectionnés : `chapter` (titre/texte), `image-pleine-largeur` (média/alt/légende) et `citation` (texte/auteur). Ils vérifient les valeurs par défaut, les props connues, le rejet d’un type inconnu et l’ordre des sections.
2. Définir une représentation project JSON de page, versionnée et identifiée par `theme_id`/`theme_version`. Les composants du projet portent des identifiants stables et des champs connus ; n’accepter aucun composant natif GrapesJS arbitraire.
3. Implémenter l’import depuis les sections publiées existantes vers un projet GrapesJS pour une page pilote. Définir explicitement ce qui arrive aux types non inclus dans le prototype : le prototype n’est activé que sur page de recette avec sections supportées, et refuse une conversion partielle silencieuse.
4. Implémenter le mapping inverse, project JSON vers sections typées, avec validation complète par `DEFAULT_BLOCKS` et le validateur existant. Conserver visibilité, variante, ordre, contenu et références médias.
5. Ajouter les tests aller-retour import → project JSON → section data, y compris les caractères accentués, HTML riche sûr, champ image vide/non vide, sections dupliquées et données malformées.
6. Exécuter `.venv/bin/python -m pytest -q tests/test_editor_project.py tests/test_editor_blocks.py tests/test_editor_validation.py`.

**Commit :** `feat(editor): define versioned theme project adapter`

## Tâche 3 : brouillon de projet et API d’édition protégée

**Fichiers :**
- Modifier `app/db.py` pour une migration additive idempotente ; créer une table dédiée aux projets visuels plutôt que d’utiliser les lignes section comme stockage implicite de JSON GrapesJS.
- Modifier `sujee_editor/routes.py` ou l’ajouter à un sous-routeur cohérent.
- Créer `tests/test_editor_project_routes.py`.

**Étapes :**

1. Écrire des tests d’API : session absente → 401 ; CSRF absent/invalide → 403 ; Origin hostile → 403 ; projet non valide/type de composant inconnu/trop volumineux → 400 ; version obsolète → 409 sans écrasement ; page inexistante → 404.
2. Ajouter une migration SQLite additive et idempotente pour une table `visual_projects` avec `page_id` (unique, FK), `draft_project_json`, `published_project_json`, `draft_version`, `theme_id`, `theme_version`, `created_at`, `updated_at`. `published_project_json` contient le projet de référence publié ; les lignes `sections` restent la projection consommée par le renderer Jinja. Ne jamais écraser les sections ou contenus existants lors de la migration.
3. Ajouter `GET` authentifié pour charger l’état de projet ; le jeton CSRF est livré de manière sûre. Ajouter `PUT` brouillon avec version attendue et limite explicite de taille. Ajouter `POST publish` transactionnel.
4. À la sauvegarde, valider le JSON du projet et le comparer à l’extension de thème activée pour cette page. À la publication, appeler l’adaptateur Python, valider les sections générées puis appliquer toutes les modifications en une transaction et créer une révision compatible avec le système existant.
5. En cas d’erreur de mapping, de validation ou d’écriture, conserver entièrement le contenu public précédent et le brouillon de travail.
6. Tester que l’API n’est pas accessible aux visiteurs et qu’un visiteur ne voit jamais la valeur brouillon, même par lecture directe des routes publiques.
7. Exécuter `.venv/bin/python -m pytest -q tests/test_editor_project_routes.py tests/test_editor_routes.py tests/test_db.py`.

**Commit :** `feat(editor): persist protected visual project drafts`

## Tâche 4 : interface GrapesJS de recette et accroche admin

**Fichiers :**
- Créer `sujee_editor/editor/static/visual-editor.js`, `visual-editor.css` et les modules nécessaires (barre, panneau, adaptateur de stockage, thème pilote).
- Ajouter une route d’admin dédiée `GET /admin/visual/{page_id}` : session admin obligatoire, sinon même redirection de connexion que le back office. Elle monte l’éditeur isolé et ne change pas l’aperçu public ni l’éditeur existant.
- Modifier `sujee_editor/editor/templates/editor/bootstrap.html` et l’enregistrement des fichiers statiques uniquement pour cette route pilote dédiée.
- Créer ou modifier les tests bootstrap appropriés, sans changer l’initialisation actuelle de `editor.js`.

**Étapes :**

1. Ajouter un test de route/page qui vérifie que seul l’admin authentifié peut ouvrir l’éditeur visuel et que le HTML public n’inclut ni GrapesJS ni JSON de projet.
2. Construire une coque simple et cohérente avec le thème Sujee : navigation claire entre sections, panneau de propriétés contextualisé, bouton enregistrer/publication, état sauvegarde, contrôle de largeur de canevas. Masquer panneaux génériques qui offrent le style/CSS libre.
3. Initialiser GrapesJS avec les assets locaux, plugin du thème chargé avant le project JSON, canvas qui importe le CSS réel du thème en lecture seule et support d’aperçu desktop/tablette/mobile.
4. Ajouter au canevas les trois blocs typés retenus. L’auteur peut éditer le titre/texte dans la page, changer l’image via la médiathèque existante et ajouter/réordonner les trois sections. Retirer/masquer les commandes de manipulation arbitraire du DOM et du style.
5. Brancher le Storage Manager/API sur les endpoints de la tâche 3. Enregistrer puis recharger doit restaurer project JSON, ordre, valeurs et variantes sans perte. L’interface indique clairement si le brouillon est sauvegardé, en attente ou en erreur.
6. Rendre les erreurs de validation et les conflits visibles, sans afficher un état optimiste faux. Pas de reprise automatique susceptible d’écraser un brouillon concurrent.
7. Exécuter tests unitaires/API/bootstrap puis `npm ci && npm run build`.

**Commit :** `feat(editor): add GrapesJS visual editor pilot UI`

## Tâche 5 : rendu public, sécurité et parcours navigateur réel

**Fichiers :**
- Modifier l’adaptateur de publication/public rendering seulement si les tests d’intégration l’exigent.
- Ajouter `tests/test_editor_visual_publish.py` et/ou un scénario Playwright/Browser Use suivant les conventions e2e existantes.

**Étapes :**

1. Écrire des tests d’intégration sur une base de recette isolée : avant publication un visiteur voit l’ancien rendu ; après publication il voit le nouveau ; après échec une publication précédente reste intacte ; restauration ramène l’état au brouillon selon le contrat existant.
2. Ajouter tests de nettoyage de contenu : balises/attributs sûrs autorisés selon les champs rich text ; `<script>`, gestionnaires `on*`, CSS inline, URL `javascript:` et composants non enregistrés refusés ou nettoyés ; vérifier la forme stockée et le rendu servi.
3. Démarrer l’application de recette avec une base seedée hors dépôt et un port dédié documenté dans l’outil de recette existant. Le serveur doit être configuré avec auth de recette, jamais avec les secrets de production.
4. Parcours navigateur : ouvrir page de recette, sélectionner une section, modifier titre/texte, remplacer une image, ajouter/réordonner, sauvegarder, recharger, publier, vérifier en visiteur. Vérifier aussi refus d’édition sans session, erreur CSRF, conflits de version, et fonctionnement à 375, 768, 1280 px.
5. Comparer le rendu public avant/après : seuls les changements expressément publiés sont visibles ; les styles de thème (typo, couleurs, espacements) n’ont pas été modifiés ; les formulaires/éléments dynamiques du site restent fonctionnels.
6. Exécuter `npm ci && npm run build`, `.venv/bin/python -m pytest -q -m "not e2e"`, puis les tests e2e ciblés et le build Docker. Consigner les résultats réels et les éventuels blocages.
7. Vérifier `git diff --check`, `git status --short`, les assets compilés réellement servis dans la recette et les journaux applicatifs. Aucun push ou déploiement production dans cette tâche.

**Commit :** `test(editor): verify GrapesJS pilot end to end`

## Tâche 6 : rendre les mises à jour GrapesJS maintenables

**Fichiers :**
- Créer `.github/dependabot.yml` pour le gestionnaire npm du sous-projet `sujee_editor/editor/frontend`.
- Créer `.github/workflows/grapesjs-editor.yml` pour compiler le bundle et exécuter les tests sur les PR et pushes concernés.
- Créer `docs/development/grapesjs-upgrades.md` (ou l’emplacement documentaire développeur existant après vérification).

**Étapes :**

1. Configurer Dependabot sur une cadence hebdomadaire, avec mises à jour npm séparées ou groupées sans confondre GrapesJS Core et dépendances de build ; limiter le bruit et ne jamais activer l’auto-merge.
2. Ajouter un workflow GitHub Actions déclenché sur PR et push touchant le kit, le thème, les tests, le lockfile ou le Dockerfile. Il exécute `npm ci`, le build frontend, les tests Python concernés et les tests de compatibilité du projet.
3. Mettre dans le pipeline des tests de lecture/réécriture de projets enregistrés par la version précédente de GrapesJS. Le workflow échoue si les assets ne sont pas construits ou si les tests de format/rendu cassent.
4. Documenter la routine de mise à niveau : examiner notes de version officielles et changelog, vérifier licence et advisories, examiner le diff du lockfile, exécuter les tests, valider une recette, puis seulement fusionner ; rollback distinct et pas de déploiement automatique.
5. Documenter la politique de version des project JSON et composants. Toute migration incompatible doit être rétrocompatible ou accompagnée d’une migration testée avant l’upgrade ; un projet non migrable ne doit pas être réenregistré sous le nouveau format.
6. Vérifier le workflow avec une PR de mise à jour simulée ou un changement de version contrôlé, sans fusionner de version non validée. Confirmer que le résultat CI est visible pour les futures PR Dependabot.
7. Vérifier les permissions du workflow : lecture seule par défaut, aucun secret de production, aucun accès au déploiement.

**Commit :** `ci(editor): automate GrapesJS dependency maintenance`

## Tâche 7 : revue et décision de suite

1. Faire une revue sécurité/qualité des changements (validation serveur, auth, XSS, permissions, données privées, stabilité du build).
2. Vérifier que l’ancien éditeur reste utilisable et qu’aucun écran de production n’a basculé.
3. Préparer pour Sujee un bilan comprenant parcours réalisé, limites ergonomiques observées, tests réellement exécutés, diffs et décision recommandée : élargir au catalogue, ajuster ou abandonner.
4. Demander l’accord séparé avant d’étendre l’éditeur à d’autres pages, retirer l’ancien éditeur, pousser une branche ou déployer quoi que ce soit.

## Ordre et dépendances

- Tâche 1 avant toute intégration frontend.
- Tâche 2 avant le stockage/API ; son modèle sérialisé est la frontière de validation.
- Tâche 3 avant le branchement de sauvegarde et publication de l’interface.
- Tâche 4 après Tâches 1 à 3.
- Tâche 5 après Tâche 4, avant toute décision d’élargissement.
- Tâche 6 après Tâches 1 à 5 afin que Dependabot/CI protègent le kit réellement livré.
- Tâche 7 ferme uniquement le prototype, jamais le chantier global.

## Non-objectifs de ce plan

- Refondre l’apparence publique du site : le brief de DA est un travail séparé.
- Migrer automatiquement l’ensemble des 19 sections ou toutes les pages existantes.
- Extraire ou publier dès le premier prototype une dépendance réutilisable officielle.
- Déployer en production, modifier le contenu de production, retirer le back office actuel, ou installer un service payant.
- Promettre une expérience équivalente à Webflow avant de l’avoir testée avec Sujee.
