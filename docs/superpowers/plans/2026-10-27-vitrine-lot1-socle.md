# Lot 1 — Socle Next.js de la vitrine : plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans. Steps use `- [ ]`
> checkboxes.

**Goal:** livrer dans `web/` une application Next.js qui sert l'accueil v5 à l'identique, avec le
châssis partagé, les redirections et le déploiement, sans toucher au back office.

**Architecture:** un dossier `web/` autonome dans le dépôt existant, Next.js App Router en sortie
standalone. Les CSS et scripts v5 sont copiés à l'identique dans `web/public/assets` et chargés comme
avant, pour garantir un rendu pixel équivalent. Le contenu de l'accueil sort du HTML et devient un
module TypeScript validé par Zod ; les sections sont des composants serveur, seuls la navigation, le
rail de lecture et les animations sont clients.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Zod, Vitest + Testing Library, Docker
node:22-alpine, Coolify.

**Spec:** `docs/superpowers/specs/2026-10-27-vitrine-next-design.md`

## Global Constraints

- Aucune modification de `app/`, `sujee_editor/`, `theme/templates/`. Le dossier `web/` est additif.
- CSS v5 repris octet pour octet : `site.css`, `light.css`, `ds.css`, `anim.css`. Toute retouche de
  style attend le lot 3.
- Mêmes URL publiques que l'ancien site : `/`, `/realisations`, `/services`, `/services/{slug}`,
  `/realisations/{slug}`, plus `/a-propos`, `/agents-ia`, `/mentions-legales`. Aucune redirection
  n'est nécessaire sur ces chemins, le référencement est préservé.
- Palette et typographie inchangées : `#0A0A09`, `#F2EFE7`, `#FF4B1F`, Bricolage Grotesque.
- TypeScript strict, aucun `any` implicite, `npm run build` doit passer sans avertissement de type.

## Review Focus

- Un lien interne qui pointe vers `.html` ou `/v5/` : le visiteur tombe sur une 404. Test : aucun
  `href` en dur dans les composants, tous passent par la table de routes.
- Le menu burger ouvert puis navigation : le panneau reste ouvert. Test : état remis à zéro au
  changement de route.
- Les scripts v5 exécutés avant l'hydratation : `site.js` ne trouve pas le DOM. Test : chargement en
  `afterInteractive` et absence d'erreur console sur la page d'accueil.
- Accessibilité du focus : le rail social et le menu doivent rester atteignables au clavier, comme
  dans v5.
- Une page servie sans CSS si `public/assets` n'est pas copié dans l'image Docker. Test : le build
  standalone contient `public/`.

---

### Task 1: Squelette de l'application

**Files:** Create `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/.gitignore`,
`web/app/layout.tsx`, `web/app/page.tsx`, `web/vitest.config.ts`, `web/tests/setup.ts`.

**Interfaces:** Produces `routes` de `web/lib/routes.ts` : `home`, `realisations`, `services`,
`service(slug)`, `realisation(slug)`, `aPropos`, `agentsIa`, `mentionsLegales`.

- [ ] `npm install` Next 15, React 19, Zod, Vitest, Testing Library, jsdom.
- [ ] `npm run build` passe, `npm run test` passe avec un test de fumée sur `routes.home === "/"`.
- [ ] Commit `chore(web): squelette Next.js`.

### Task 2: Assets v5 à l'identique

**Files:** Copy `theme/v5/assets/*` → `web/public/assets/` (CSS, JS, img, SVG, favicon).

- [ ] Test d'intégrité : `sha256` des 4 CSS et 3 JS identiques à la source.
- [ ] Commit `chore(web): assets v5 copiés à l'identique`.

### Task 3: Châssis partagé

**Files:** `web/components/site/{SiteNav,SocialRail,SiteFooter,SkipLink,SiteScripts}.tsx`.

- [ ] Test : la nav rend les 5 services et le CTA, le footer rend les mentions légales.
- [ ] `SiteNav` client (état scroll + burger), `SiteScripts` charge `/assets/site.js` en
  `afterInteractive` puis `anim.js`, GSAP en CDN comme v5.
- [ ] Commit `feat(web): châssis partagé`.

### Task 4: Contenu typé de l'accueil

**Files:** `web/lib/content/schema.ts`, `web/content/home.ts`, `web/tests/content.test.ts`.

- [ ] Schéma Zod : `hero`, `studio`, `numbers[4]`, `cases[3]`, `method[3]`, `services[5]`, `cta`.
- [ ] Tests : le contenu réel passe ; un champ manquant échoue avec un message lisible.
- [ ] Commit `feat(content): accueil typé et validé`.

### Task 5: Sections de l'accueil

**Files:** `web/components/home/{Hero,Studio,Cases,Method,Services,CtaBand}.tsx`,
`web/app/page.tsx`.

- [ ] Rendu identique au v5 : mêmes classes, même ordre, mêmes textes.
- [ ] Test : titre du hero, 4 chiffres, 3 études de cas, 3 étapes, 5 services.
- [ ] Commit `feat(web): accueil v5 porté en composants`.

### Task 6: Métadonnées, sitemap et 404

**Files:** `web/app/layout.tsx`, `web/app/sitemap.ts`, `web/app/robots.ts`, `web/app/not-found.tsx`.

- [ ] `metadata` reprend title/description/theme-color du v5, JSON-LD `ProfessionalService`.
- [ ] Commit `feat(seo): métadonnées, sitemap, robots, 404`.

### Task 7: Redirections

**Files:** `web/next.config.ts`, `web/tests/redirects.test.ts`.

- [ ] `/v5` et `/v5/:path*` → `/` en 301 ; `/*.html` → équivalent sans extension en 301.
- [ ] Commit `feat(web): redirections des anciennes URL`.

### Task 8: Déploiement

**Files:** `web/Dockerfile`, `web/next.config.ts` (`output: "standalone"`),
`docs/EXPLOITATION.md`.

- [ ] Build Docker local réussi, conteneur sert `/` en 200.
- [ ] Commit `chore(web): image de production`.

### Task 9: Vérification visuelle

- [ ] Serveur local, captures desktop 1440 et mobile 390, comparaison avec `/v5/`.
- [ ] Aucune erreur console, LCP mesuré sur le build de production.
