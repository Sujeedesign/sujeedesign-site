# Recette de la bascule de l’admin vers GrapesJS

## Contrat de l’éditeur

- L’éditeur unique des pages est `/admin/pages/{id}`.
- `/admin/visual/{id}` reste un alias temporaire et redirige en 303 vers la route canonique.
- Le thème GrapesJS est version 3 : il couvre les 19 blocs historiques et la nouvelle section `zone-libre`. L’aperçu central est rendu par les templates Jinja réels dans une iframe sandboxée; GrapesJS reste le modèle de composition. La section `zone-libre` propose 1 à 3 colonnes, une grille de 12, des fonds parmi les couleurs du thème ou une image locale, trois espacements et un alignement par colonne, sans CSS libre.
- La sauvegarde crée un brouillon de projet versionné. Seule l’action de publication matérialise les sections publiques. Les brouillons ne sont jamais rendus aux visiteurs.
- Le panneau des paramètres regroupe les champs éditoriaux, menu, référencement, métadonnées et médias. Le panneau d’historique liste les révisions et exige une confirmation si la restauration remplace un brouillon divergent.
- La publication, l’export JSON, la restauration d’une révision et le rollback de l’image sont des opérations distinctes. Un rollback applicatif ne réécrit pas la base SQLite.
- Le statut de page et sa suppression restent dans le module Pages. Médias, messages, réglages/redirections et sauvegarde restent accessibles hors de l’éditeur.

## Préparer une recette isolée

1. Utiliser uniquement l’application Coolify `sujeedesign-site-staging` (`zxb1kdvv8qqbukxhsvsi7aq1`) et son stockage de recette. Ne jamais réutiliser ou restaurer les données de production sur cette cible.
2. Préparer une copie assainie de contenu, sans coordonnées ni messages personnels. Conserver une sauvegarde de la base et des médias de recette avant import.
3. Déployer la preview PR #2 de l’application Coolify de recette (`pull_request_id=2`), jamais l’application de production; vérifier `/api/health` retourne HTTP 200 avant toute écriture.
4. Ouvrir chaque page en mode administrateur et charger le projet thème v3. Pour chaque page, comparer le nombre, l’ordre, le type et les données des sections avec l’export source. Arrêter à la première conversion avec perte.
5. Sur un jeu représentatif comprenant les 20 types, tester ajout, déplacement, édition de champs simples et répétables, sauvegarde, rechargement et publication. Pour `zone-libre`, vérifier les colonnes et les styles autorisés. Comparer l’ordre et les champs avant/après.
6. Vérifier le rendu public Jinja de la page publiée et l’absence de texte de brouillon. Vérifier une restauration de révision avec et sans confirmation d’un brouillon divergent.
7. Vérifier les modules Pages, Médias, Messages, Réglages/redirections et Sauvegarde, ainsi que les contrôles desktop et mobile. Exporter le contenu de recette et relire `/api/health`.
8. Consigner le SHA testé, les résultats et toute anomalie. Ne pas promouvoir en production avant revue des résultats et approbation explicite séparée.

## Retour arrière

1. Arrêter la recette si une page ne s’importe pas sans perte ou si le rendu publié diverge.
2. Redéployer l’image de l’application précédente sur la cible de recette. Ne pas lancer de restauration de base dans le cadre d’un rollback d’image : la base et les médias restent inchangés.
3. Si une restauration de données est réellement nécessaire, utiliser uniquement la sauvegarde prise avant la recette et la procédure de sauvegarde/restauration de `docs/EXPLOITATION.md`.
4. Vérifier le healthcheck, l’admin et le rendu public avant de déclarer la recette rétablie.

## Limites de la validation locale

La recette ne remplace pas les tests : build Vite, suite backend, suite Playwright et build de l’image doivent être exécutés avant promotion. Si l’environnement local ne possède pas Chromium ou ne peut pas construire l’image faute de daemon Docker, ces contrôles restent bloquants et doivent être exécutés sur un runner compatible.
