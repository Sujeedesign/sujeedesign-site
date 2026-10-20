# Procédure de mise à jour GrapesJS

## Périmètre et règles

- GrapesJS Core est la seule dépendance d’édition; Studio SDK et runtime CDN ne sont pas utilisés.
- Les versions npm exactes sont consignées dans `sujee_editor/editor/frontend/package.json` et `package-lock.json`.
- Dependabot ouvre des PR hebdomadaires dans le sous-projet frontend. Aucune PR ne doit être fusionnée automatiquement.
- Une mise à jour ne part pas automatiquement en recette ou en production. Le déploiement reste une décision explicite après validation.
- Le projet sauvegardé possède son propre `schema_version`, `theme_id` et `theme_version`; ne pas les confondre avec la version npm de GrapesJS.

## Contrôles de chaque PR

1. Examiner le changelog et les notes de migration officiels de GrapesJS, le diff du lockfile, la licence et les avis de sécurité.
2. Exécuter `npm ci --prefix sujee_editor/editor/frontend` puis `npm run build --prefix sujee_editor/editor/frontend`.
3. Exécuter `npm run test:smoke --prefix sujee_editor/editor/frontend`. Le smoke vérifie l’insertion de composants, l’édition, le stockage du JSON, le choix d’un média, la rebase confirmée après un conflit et l’absence de sauvegarde parasite après rechargement, plus les largeurs mobile/tablette/desktop.
4. Exécuter `python -m pytest -q -m "not e2e"`. La suite vérifie le mapping projet/sections, les autorisations, le contrôle de version, la détection de modifications classiques concurrentes, la rebase et la publication Jinja.
5. Vérifier la construction de l’image avec `docker build --tag sujee-site-editor-check .`.
6. Vérifier `git diff --check`. La CI de `.github/workflows/grapesjs-editor.yml` réalise les mêmes contrôles, avec Chromium, sur les PR et pushes concernés.

## Compatibilité des projets

- Conserver un projet antérieur de référence si une mise à jour change le format émis par GrapesJS ou le format de sérialisation des composants.
- Avant de réenregistrer un projet existant, charger et sérialiser le projet de référence avec les plugins du thème activés; comparer les champs, l’ordre, les identifiants et les références de médias.
- Si la lecture rétrocompatible n’est pas garantie, ajouter une migration Python explicite et des tests sur les versions source et cible. Ne pas faire migrer silencieusement les projets en production.
- Ne jamais publier directement le HTML/CSS sérialisé par GrapesJS. La publication doit toujours passer par l’adaptateur du thème et sa liste blanche.

## Recette, fusion et retour arrière

1. Après validation CI, déployer le candidat sur l’environnement de recette avec une copie isolée des contenus représentatifs.
2. Tester l’ouverture, la modification, la sauvegarde, le rechargement, la publication, la restauration et les trois sections du pilote.
3. Vérifier le rendu public, les styles du thème, les médias et les fonctions métier. Conserver l’ancienne interface pendant la comparaison.
4. Fusionner seulement après approbation de la recette. Le déploiement production est distinct et utilise la procédure `sujeedesign-site`.
5. En cas de défaut, revenir au commit ou à l’image précédente; ne pas réécrire les JSON déjà publiés sans migration testée.
