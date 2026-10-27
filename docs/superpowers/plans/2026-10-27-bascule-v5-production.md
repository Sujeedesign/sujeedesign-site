# Bascule du v5 en production (vitrine Next.js)

Date : 27/10/2026
Branche : `feat/vitrine-next` (commit `3b47d49`), app dans `web/`.

## Ce qui est prêt et vérifié

- Portage intégral du thème v5 : home, `/realisations`, `/realisations/vaasam`,
  `/services` + 4 pages service, `/a-propos`, `/agents-ia`, `/mentions-legales`, 404.
- Parité texte du `<main>` : **11/11 pages identiques** au v5 statique (`web/scripts/parity.py`).
- Géométrie du `h1` et responsive 390 px identiques (mêmes `top/left/width/height`,
  même `font-size`, `overflow-x = 0`, aucune image cassée, burger présent).
- `next build` OK (16 routes, sortie standalone), `tsc --noEmit` 0, `vitest` vert.
- Animations du v5 conservées : GSAP 3.13 + ScrollTrigger servis localement depuis
  `web/public/assets` (aucun CDN, aucun chargement bloquant), `site.js`, `anim.js`
  et `rl.js` chargés après hydratation. Vérifié en navigateur : hero pinné (1 trigger),
  `pin-spacer` créé, `h1` de `/realisations` révélé (`is-in`), 0 débordement à 390 px.
- SEO construit côté Next : `sitemap.xml`, `robots.txt`, OpenGraph, Twitter,
  JSON-LD `ProfessionalService`, canonical par page.
- Redirections `301` strictes vers les nouvelles URL :
  - `/v5` → `/`, et chaque page `/v5/*.html` → sa page équivalente
    (`/v5/a-propos.html` → `/a-propos`, `/v5/projet.html` → `/realisations/vaasam`,
    `/v5/service-identite.html` → `/services/identite-de-marque`, etc.)
  - anciens fichiers `.html` (`/index.html`, `/apropos.html`, `/identite.html`…)
  - anciennes routes FastAPI (`/services/identite`, `/services/ia`,
    `/realisations/vaasam-paris` → page équivalente)
  - `/contact`, `/contact.html` → `/a-propos#contact` (ancre réelle sur le bloc CTA)
  - `/services/agents-ia` → `/agents-ia`
- 404 réelle sur les URL inconnues, `sitemap.xml` et `robots.txt` à 200.

## Ce qui n'est pas vérifié

- `docker build` de l'image finale : le daemon Docker n'était pas joignable lors
  du dernier passage. Le Dockerfile (`node:22-alpine`, multi-stage, standalone,
  user non-root `nextjs`, port 3000, `HEALTHCHECK` sur `/` via `wget`) a été
  complété depuis ; à build via le builder Coolify avant la bascule.
- `npm start` écoute désormais 3000, comme le conteneur (plus d'ambiguïté de port).

## Configuration Coolify cible

Application actuelle : `sujeedesign` (`zbfls3fq6aiwtoouhkj8vpye`), FastAPI,
domaine racine, branche `main`, `base_directory /`, port 8080, health `/api/health`.

Nouvelle application :

- nom `sujeedesign-web`
- repo `https://github.com/Sujeedesign/sujeedesign-site.git`
- branche `main` (après merge de `feat/vitrine-next`)
- `base_directory` : `/web`
- build pack : Dockerfile, `dockerfile_location` : `/web/Dockerfile`
- `ports_exposes` : `3000`
- `health_check_path` : `/`
- domaines : `https://sujeedesign.com,https://www.sujeedesign.com`

## Point de vigilance : le back office `/admin`

L'application FastAPI actuelle sert aussi `/admin` (back office et éditeur de
blocs) sur le domaine racine. Si le domaine bascule sur Next sans rien prévoir,
`/admin` renvoie 404.

Deux options, à trancher :

1. **Garder l'admin** : donner à l'app FastAPI un sous-domaine
   (`admin.sujeedesign.com`, à créer côté DNS) et ne mettre que la vitrine sur
   la racine. C'est la seule option qui ne coupe rien.
2. **Bascule sèche** : la racine passe sur Next, l'admin reste accessible par
   l'ancienne app arrêtée ou par son URL temporaire Coolify jusqu'à ce que le
   produit admin autonome soit prêt.

Tant que ce point n'est pas tranché, la bascule n'est pas exécutée.

## Séquence de bascule

1. Merger `feat/vitrine-next` dans `main`.
2. Créer l'application Coolify `sujeedesign-web` avec la configuration ci-dessus,
   sans domaine dans un premier temps, déployer, vérifier la santé.
3. Trancher le sort de `/admin` (option 1 recommandée).
4. Déplacer les domaines `sujeedesign.com` et `www.sujeedesign.com` de l'app
   FastAPI vers `sujeedesign-web`.
5. Vérifier en ligne : `/` 200, les 9 routes 200, `/services/agents-ia` 301,
   `/v5` 301, `/nimporte-quoi` 404, `sitemap.xml` et `robots.txt` 200,
   et une capture desktop + mobile.
6. Supprimer l'ancienne route `/v5` du code FastAPI (plus servie).

## Rollback

Redéplacer les domaines sur l'application `sujeedesign` d'origine : elle reste
en place, image et volume `/data` intacts, jusqu'à validation complète.
