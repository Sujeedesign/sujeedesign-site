# Bascule du v5 en production (vitrine Next.js)

Date : 27/10/2026
Statut : **bascule effectuée** (voir « État final » en bas).

## Ce qui est prêt et vérifié

- Portage intégral du thème v5 : home, `/realisations`, `/realisations/vaasam`,
  `/services` + 4 pages service, `/a-propos`, `/agents-ia`, `/mentions-legales`, 404.
- Parité texte du `<main>` : **11/11 pages identiques** au v5 statique (`web/scripts/parity.py`).
- Géométrie du `h1` et responsive 390 px identiques (mêmes `top/left/width/height`,
  même `font-size`, `overflow-x = 0`, aucune image cassée, burger présent).
- `next build` OK (16 routes, sortie standalone), `tsc --noEmit` 0, `vitest` vert.
- Animations du v5 conservées : GSAP 3.13 + ScrollTrigger servis localement depuis
  `web/public/assets` (aucun CDN, aucun chargement bloquant), `site.js`, `anim.js`
  et `rl.js` chargés après hydratation.
- SEO construit côté Next : `sitemap.xml`, `robots.txt`, OpenGraph, Twitter,
  JSON-LD `ProfessionalService`, canonical par page.
- Redirections `301` strictes vers les nouvelles URL (détail plus bas).

## Configuration Coolify

### Vitrine Next.js

- nom `sujeedesign-web`, uuid `kbt19dmgg3tnm6azvdcvuegg`
- projet `Hermes Agent` (`mozs7ed4twhv6thvvfxsobz9`), env `production`
- serveur `jsvjpfio8b4r0nm7atlucfcq`, destination `tlmpradiwhqmhog6l6zjbcej`
- repo `https://github.com/Sujeedesign/sujeedesign-site.git`, branche `main`
- `build_pack` dockerfile, `base_directory` `/web`, `dockerfile_location` `/Dockerfile`
- `ports_exposes` `3000`, health `/` sur 3000
- domaines : `https://sujeedesign.com,https://www.sujeedesign.com` (+ URL sslip de secours)

Le Dockerfile est multi-stage (`node:22-alpine`), sortie standalone, user `nextjs`,
`HEALTHCHECK` sur `/`. Build vérifié par le builder Coolify, image en production.

## Back office `/admin`

Le back office (FastAPI + Jinja + `sujee_editor`) monte ses assets à la **racine**
(`/assets`, `/medias`), donc il ne peut pas cohabiter avec la vitrine sur le même
hôte sans collisions de chemins ni proxy. Décision : **il garde son propre hôte**.

- application FastAPI `sujeedesign` (`zbfls3fq6aiwtoouhkj8vpye`), toujours
  déployée avec son volume `/data` et sa base.
- hôte actuel : `https://admin-sujeedesign.145.241.167.66.sslip.io`
  (`/admin` → 303 vers `/admin/connexion`, `/assets/admin.css` 200).
- à faire quand le DNS sera accessible : créer un `A`/`CNAME`
  `admin.sujeedesign.com` → `145.241.167.66`, l'ajouter aux domaines de l'app
  FastAPI, puis retirer l'hôte sslip.
- `/admin` sur `sujeedesign.com` renvoie **404** : c'est voulu, la vitrine ne
  proxyfie pas le back office.

## Redirections 301 en production

- `/v5` → `/` ; chaque `/v5/*.html` → sa page équivalente
  (`/v5/a-propos.html` → `/a-propos`, `/v5/projet.html` → `/realisations/vaasam`,
  `/v5/service-identite.html` → `/services/identite-de-marque`, etc.)
- anciens fichiers `.html` (`/index.html`, `/apropos.html`, `/identite.html`…)
- anciennes routes FastAPI (`/services/identite`, `/services/ia`,
  `/realisations/vaasam-paris`)
- `/contact`, `/contact.html` → `/a-propos#contact` (ancre réelle sur le bloc CTA)
- `/services/agents-ia` → `/agents-ia`

Seule exception : `/v5/` (avec slash final) est normalisé en `308` vers `/v5`
par Next avant la redirection ; `/v5` répond ensuite `301` vers `/`. Les deux
codes sont permanents.

## État final (vérifié le 27/10/2026)

Vérifications faites en ligne, après bascule :

| contrôle | résultat |
| --- | --- |
| `/`, `/services`, `/agents-ia`, `/realisations`, `/realisations/vaasam`, `/a-propos`, `/mentions-legales` | 200 |
| `/sitemap.xml`, `/robots.txt` | 200 |
| `/nimporte-quoi` | 404 |
| `/v5/projet.html`, `/apropos.html`, `/services/identite`, `/contact` | 301 vers la bonne cible |
| `/admin` sur la racine | 404 (voulu) |
| back office sslip | `/admin/connexion` 200, assets 200 |
| HTTPS apex + www + hôte admin | certificats Let's Encrypt valides |
| navigateur desktop | `gsap` + `ScrollTrigger` chargés, hero pinné (1 `pin-spacer`), `is-in` sur `/realisations` |
| navigateur 390 px | `scrollWidth = clientWidth = 390`, 1 `h1` par page |

## Rollback

L'application `sujeedesign` (`zbfls3fq6aiwtoouhkj8vpye`) reste déployée, image et
volume `/data` intacts. Pour revenir en arrière : lui rendre les domaines
`sujeedesign.com` + `www.sujeedesign.com` et redéployer, puis retirer ces domaines
de `sujeedesign-web`. Le site FastAPI d'origine reprend la racine tel quel.
