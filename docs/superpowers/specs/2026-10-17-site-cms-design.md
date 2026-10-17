# Refonte sujeedesign.com — site vitrine dynamique piloté par un back office

Date : 17 octobre 2026
Statut : validé dans son principe, implémentation en cours

## 1. Objectif

Refondre sujeedesign.com en un site vitrine complet, développé comme une vraie application web avec routage propre, entièrement piloté par un back office indépendant de la plateforme CRM :

- Accueil : vitrine qui présente l'ensemble du travail et les prestations.
- Réalisations : une page qui regroupe toutes les réalisations (`/realisations`), une page individuelle par réalisation (`/realisations/<slug>`).
- Services : une page qui regroupe tous les services (`/services`), une page individuelle par service (`/services/<slug>`).
- Contact : page avec formulaire fonctionnel, messages stockés et notifiés.
- Back office : modifier chaque contenu, chaque page, créer et réordonner des sections, gérer les médias, publier.

Aucune URL avec extension `.html`. Contenu rendu côté serveur, indexable, rapide.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Back office | Indépendant du CRM. Application dédiée, pas de module dans crmsjd. |
| Nature du site | Application web dynamique (rendu serveur), routage propre, pas de site statique, pas de SPA. |
| URLs | Chemins propres sans extension : `/`, `/realisations`, `/realisations/<slug>`, `/services`, `/services/<slug>`, `/contact`, `/a-propos`, `/mentions-legales`. Redirections 301 depuis les anciens `.html` pour préserver le référencement. |
| Direction artistique | Conservée : noir/blanc premium, accent iridescent, Archivo + Space Grotesk, tokens de `assets/site.css`. |
| Formulaire de contact | Message stocké dans le back office + notification Telegram immédiate + email récapitulatif. |
| Réalisations | Les 4 existantes au lancement, complétées depuis le portfolio Behance (https://www.behance.net/SujeepanSabesan). Sujee modifie/ajoute ensuite via le back office. |

## 3. Architecture technique

### 3.1 Vue d'ensemble

Une application unique `sujeedesign-site` (FastAPI + SQLite + Jinja2) sert :

- les pages publiques, rendues côté serveur à chaque requête depuis la base de contenu, avec cache mémoire et ETag,
- le back office (`/admin`) et son API (`/api/admin/*`),
- l'API publique du formulaire de contact (`/api/contact`),
- les ressources SEO (`/sitemap.xml`, `/robots.txt`, `/favicon.svg`) et le catalogue de médias.

Elle est déployée par Coolify sur le serveur existant, sur le domaine sujeedesign.com (application Coolify `sujeedesign` reconfigurée). Aucune modification DNS n'est nécessaire.

### 3.2 Principes

- HTML rendu côté serveur : le contenu est dans la réponse HTTP initiale, lisible sans JavaScript, indexable. Le JavaScript n'ajoute que le confort (menu mobile, shader du CTA, galerie, soumission du formulaire).
- Routage explicite : une route par famille de page, aucune extension dans l'URL, barre oblique finale normalisée par redirection.
- Le contenu est la seule variable : les gabarits sont versionnés dans le dépôt, la base ne contient que du contenu.
- Indépendance totale vis-à-vis de crmsjd : aucun couplage base, déploiement, session.
- Une seule unité à déployer, donc rollback simple et état observable (logs Coolify, `/api/health`).

### 3.3 Composants

```
sujeedesign-site/
  app/
    main.py          création de l'app, montage des routeurs, middleware
    routes/
      public.py      accueil, listes, fiches, pages libres, 404
      redirects.py   table des redirections 301 depuis les anciens chemins
      contact.py     formulaire public + API
      admin.py       back office (écrans + API)
      api_sync.py    export du contenu pour sauvegarde et synchronisation
    db.py            schéma SQLite, migrations idempotentes
    content.py       requêtes et écritures sur les entités
    render.py        rendu Jinja2, cache, ETag, sitemap, JSON-LD
    auth.py          session signée HMAC, TOTP, limitation de débit
    media.py         upload, variantes WebP, miniatures
    slugify.py       génération et unicité des slugs
  theme/
    templates/       base, pages, sections typées, partiels
    assets/          site.css, JS, images (repris du site actuel)
  seed/content.json  contenu initial (12 pages migrées + projets Behance)
  tests/             unitaires, rendu, routage, e2e
  Dockerfile
  docs/
```

### 3.4 Données et persistance

- SQLite `site.db` dans un volume persistant Coolify (`/data`), comme le fait déjà crmsjd.
- Médias dans `/data/medias`, servis en `/medias/...`, variantes WebP générées à l'upload.
- Cache de rendu en mémoire, invalidé automatiquement à chaque publication (clé de version globale).
- Export JSON du contenu via `/api/sync/content`, récupéré par un cron local Hermes et commité dans le dépôt : sauvegarde versionnée sans complexité dans le conteneur.

### 3.5 Déploiement

1. Dépôt GitHub public `Sujeedesign/sujeedesign-site` (code, gabarits, seed ; aucun secret).
2. Application Coolify de recette `sujeedesign-site-staging` construite depuis ce dépôt, sans domaine, exposée sur un port local (`8131:8080`), volume `/data` dédié.
3. Validation complète sur la recette (parcours, back office, formulaire, tests, navigateur).
4. Bascule de l'application Coolify `sujeedesign` : `build_pack=dockerfile`, dépôt et branche du nouveau projet, port 8080, healthcheck `/api/health`, volume `/data`, domaines conservés (`sujeedesign.com`, `www`).
5. Vérification en production (chaque URL, redirections 301, en-têtes, sitemap, formulaire, back office).
6. Rollback : reconfiguration de l'application en `dockerimage` `caddy:2` avec son montage actuel (`/opt/data/atelier/deploy`), conservé intact pendant toute l'opération.

## 4. Modèle de contenu

### 4.1 Entités

- `pages` : slug, chemin, type (`accueil`, `liste_realisations`, `detail_realisation`, `liste_services`, `detail_service`, `contact`, `a-propos`, `mentions-legales`, `libre`, `404`), titre, statut (`brouillon`/`publié`), SEO (title, description, og_image, robots), position au menu, date de publication.
- `sections` : page, position, type, variante, titre interne, visible, contenu JSON, réglages d'affichage (fond, largeur, espacement).
- `realisations` : slug, titre, client, année, catégories, accroche, description, mission, approche, résultats, crédits, lien externe, services liés, galerie, image de couverture, statut, SEO, mise en avant, source (Behance ou saisie).
- `services` : slug, titre, accroche, description, contenu par blocs, étapes du process, prestations incluses, FAQ, fourchette de prix, réalisations liées, statut, ordre.
- `medias` : fichier, alt obligatoire, légende, crédits, dimensions, variantes, type.
- `messages` : nom, email, téléphone, type de projet, budget, message, page d'origine, statut (`nouveau`, `lu`, `répondu`, `spam`, `archivé`), horodatage, IP hachée.
- `reglages` : nom, tagline, coordonnées, réseaux, identifiants d'analyse, textes du pied de page, SEO par défaut.
- `revisions` : instantané JSON d'une page ou d'une entité, auteur, date, motif, restauration en un clic.
- `redirections` : ancien chemin, nouveau chemin, code (301), compteur d'usage.

### 4.2 Types de sections (v1)

`hero` (variantes accueil / page interne), `manifeste`, `grille-projets` (auto ou manuelle), `liste-services` (auto), `texte-riche`, `image-pleine-largeur`, `galerie`, `chiffres-cles`, `process`, `citation`, `faq`, `logos-clients`, `etude-de-cas` (mission / approche / résultats), `cta-final` (CTA iridescent avec shader, repris du site actuel), `formulaire-contact`, `bloc-liens`.

Chaque section est un composant de gabarit versionné : son rendu vient du code, son contenu de la base. Ajouter une variante ne casse aucun contenu existant.

### 4.3 Back office

- Connexion par mot de passe (variable d'environnement) + session signée, TOTP en second facteur, limitation de débit sur la connexion.
- Tableau de bord : messages nouveaux, brouillons, dernière publication.
- Pages : liste, création, duplication, éditeur de sections (ajouter, choisir le type, remplir, déplacer, masquer, supprimer), aperçu réel avant publication.
- Réalisations et services : CRUD complet, galeries, liaison service ↔ réalisation, SEO par fiche.
- Médias : upload par glisser-déposer, alt et légende obligatoires, redimensionnement et WebP automatiques.
- Messages : liste filtrable, marquage, réponse par email en un clic, export CSV.
- Réglages : identité, coordonnées, réseaux, analyse d'audience.
- Publication : bouton « Publier » qui invalide le cache des pages impactées, affiche le diff, journalise l'action et permet de revenir à une révision antérieure.
- Sauvegarde : export JSON complet téléchargeable.

### 4.4 Cycle de vie du contenu

Brouillon (invisible, aperçu authentifié) → Publier → en ligne. Chaque modification est conservée en révision, retour possible en un clic.

## 5. SEO et accessibilité

- URLs propres, sans extension, normalisées (redirection 301 depuis la variante avec ou sans barre oblique).
- Redirections 301 depuis les 12 anciens chemins `.html` vers les nouveaux (voir table en annexe).
- Balises title/description uniques, canonical, Open Graph et Twitter Card par page et par fiche.
- Données structurées : `Person`/`ProfessionalService` (accueil, contact), `Service` (fiches service), `CreativeWork` (fiches réalisation), `BreadcrumbList`, `FAQPage` là où une FAQ est publiée.
- `sitemap.xml` et `robots.txt` servis dynamiquement, cohérents avec les URLs canoniques.
- Accessibilité : hiérarchie de titres séquentielle, focus visible, contraste AA, lien d'évitement, menu mobile utilisable au clavier, `prefers-reduced-motion` respecté. Les règles testées sur le site actuel sont conservées.
- Performance : réponse rendue serveur avec ETag et cache, CSS unique, images WebP dimensionnées, script du shader chargé après le contenu.

Rédaction éditoriale et audit SEO confiés au profil Sita (métadonnées, textes des listes, maillage interne, audit technique).

## 6. Formulaire de contact

- Champs : nom, email, téléphone (optionnel), type de projet, budget (optionnel), message, consentement.
- Anti-spam : champ piège, jeton de formulaire signé et horodaté, limitation de débit par IP, filtrage des liens en masse. Turnstile ajouté seulement si nécessaire.
- Validation serveur stricte, erreurs compréhensibles, confirmation avec numéro de référence.
- Enregistrement en base, notification Telegram immédiate et email récapitulatif via un cron local Hermes.
- Repli : si l'API échoue, email direct pré-rempli proposé.

## 7. Tests et validation

- Unitaires : schéma et migrations, slugs, requêtes de contenu, authentification, session, anti-spam, redirections.
- Rendu : chaque section produit le HTML attendu, hiérarchie de titres valide sur toutes les pages générées, échappement HTML des contenus.
- Routage : chaque route répond 200, les anciens chemins répondent 301 vers la bonne cible, les slugs inconnus répondent 404.
- Portage des 28 tests existants (harmonisation, pages projet, accessibilité).
- Parcours navigateur réels : navigation complète, soumission du formulaire, connexion au back office, édition d'une section, publication, vérification du contenu en ligne.
- Contrôles : aucun débordement horizontal en 375/768/1024/1440 px, contrastes, focus, `prefers-reduced-motion`, en-têtes de cache, sitemap, données structurées, Core Web Vitals de base.
- Revue visuelle des captures par le profil Mira avant bascule en production.

## 8. Risques et parades

| Risque | Parade |
|---|---|
| Coupure du site public lors de la bascule | Recette validée sans domaine ; bascule en gardant l'image et le montage actuels ; rollback en une reconfiguration. |
| Perte de contenu | Volume persistant + export JSON horaire commité + révisions + export manuel. |
| Perte de référencement | URLs propres + redirections 301 exhaustives + sitemap + canoniques. |
| Régression visuelle | Gabarits repris du CSS actuel, tests d'harmonisation portés, revue par captures. |
| Spam sur le formulaire | Champ piège, jeton signé, limitation de débit, Turnstile en réserve. |
| Site dynamique moins disponible qu'un statique | Conteneur supervisé par Coolify, healthcheck, redémarrage automatique, cache mémoire, dépendances minimales. |

## 9. Hors périmètre (v1)

- E-commerce et paiement en ligne.
- Blog / actualités (le modèle de sections le permettra, sans écran dédié).
- Multilingue.
- Espace client connecté côté public.
- Migration vers un autre hébergement.

## 10. Phases

1. **P0 Fondations** : dépôt, application, schéma, routage, rendu, migration des 12 pages à parité visuelle.
2. **P1 Pages publiques** : accueil vitrine, listes et fiches réalisations/services, contact, à-propos, mentions, 404, redirections 301.
3. **P2 Back office** : auth, éditeur de sections, entités, médias, révisions, publication.
4. **P3 Contact** : API, anti-spam, stockage, notifications Telegram et email.
5. **P4 SEO, contenu et qualité** : données structurées, sitemap, contenus et audit Sita, revue Mira, accessibilité et performance.
6. **P5 Mise en production** : recette, bascule Coolify, vérification réelle, surveillance des premières 48 h.

## Annexe — Table de redirections 301

| Ancien chemin | Nouveau chemin |
|---|---|
| `/index.html` | `/` |
| `/apropos.html` | `/a-propos` |
| `/contact.html` | `/contact` |
| `/identite.html` | `/services/identite` |
| `/creation-visuelle.html` | `/services/creation-visuelle` |
| `/web.html` | `/services/web` |
| `/marketing.html` | `/services/marketing` |
| `/ia.html` | `/services/ia` |
| `/projet-vaasam.html` | `/realisations/vaasam-paris` |
| `/projet-rfa.html` | `/realisations/resto-franchise-africain` |
| `/projet-ia.html` | `/realisations/solutions-ia-automations` |
| `/projet-formation.html` | `/realisations/formation-ui-ux-pao` |
