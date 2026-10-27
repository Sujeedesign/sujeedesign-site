# Vitrine Sujee Design sur Next.js, socle évolutif et IA

Date : 2026-10-27
Branche : `feat/vitrine-next`
Statut : à valider

## 1. Contexte

Le site public actuel est servi par l'application FastAPI (`app/main.py`), avec un thème Jinja
historique et une préversion statique montée sur `/v5` (`theme/v5`, 11 pages HTML, 2 842 lignes).

Constat mesuré sur `theme/v5` :

- 11 pages, dont 4 pages service quasi identiques (177 lignes chacune)
- nav et footer dupliqués à la main sur chaque page
- 4 feuilles CSS : `site.css` 56 Ko (déjà sectionné par page), `light.css` 89 Ko, `ds.css` 22 Ko, `anim.css` 3 Ko
- 3 scripts : `site.js`, `anim.js`, `rl.js` ; GSAP 3.13 en CDN sur 2 pages seulement
- contenu 100 % en dur, aucun champ éditable, aucun Jinja
- 9 images, environ 956 Ko, 3 SVG de logo

Le back office (FastAPI + Jinja + `sujee_editor`) reste en l'état. Il n'est pas modifié par ce chantier.

La direction retenue est une vitrine Next.js qui deviendra le socle du site public, conçue dès le
départ pour accueillir des fonctionnalités IA (assistant commercial, qualification de prospects,
pont vers le CRM), et non un site statique auquel on grefferait un chatbot.

## 2. Objectifs

1. Reprendre la vitrine v5 en Next.js sans perte de design ni d'animations.
2. Sortir le contenu du HTML vers une couche de contenu typée, source unique des pages et de l'index IA.
3. Poser un socle serveur capable d'héberger des fonctionnalités IA sans refonte : routes serveur,
   streaming, garde-fous de coût, base de données.
4. Préparer le pont avec le CRM (prospect créé et devis préparé depuis une conversation).
5. Garder le déploiement simple : un conteneur, Coolify, aucun service supplémentaire non justifié.

## 3. Non-objectifs

- Modifier le back office ou l'éditeur GrapesJS
- Réécrire le CSS ou changer la direction artistique
- Migrer vers un CMS tiers (Strapi, Sanity, Payload)
- Ajouter une authentification publique, un espace client ou du e-commerce
- Générer des images ou du contenu décoratif par IA sur la vitrine

## 4. Décision d'architecture

### Next.js App Router en Node standalone, pas en export statique

Le rendu des pages est prérendu et revalidé (ISR), les routes `/api` sont dynamiques.
Les deux cohabitent dans le même conteneur `output: "standalone"`.

Pourquoi pas l'export statique : les routes IA ont besoin d'un serveur pour garder les clés,
streamer les réponses, limiter les débits et appeler les outils. Un export statique condamnerait
le socle à une refonte.
Pourquoi pas Vite + React nu : pas de rendu serveur, SEO dégradé sur une vitrine à enjeu local,
et aucune couture pour la couche contenu ou les routes API.
Pourquoi pas Astro : techniquement le meilleur pour un site majoritairement statique, mais il
ajoute un second écosystème alors que l'admin et le CRM sont déjà en React. Le compromis retenu
est Next, avec des pages quasi entièrement serveur et des îlots clients limités aux animations.

### Emplacement dans le dépôt

Même dépôt `Sujeedesign/sujeedesign-site`, nouveau dossier `web/`. L'application FastAPI existante
n'est ni déplacée ni renommée. Deux applications Coolify pointent sur le même dépôt :

- `sujeedesign-web` : racine `web/`, Node, domaine public
- `sujeedesign` : racine `.`, Python, admin et API, sous-domaine `admin.`

Avantage : un seul historique, une seule revue, un rollback immédiat. Le dossier `web/` reste
indépendant au niveau des dépendances (son propre `package.json`, pas de workspace npm partagé
pour l'instant).

## 5. Couche de contenu

Les textes quittent le HTML pour `web/content/` :

```
content/
  site.ts            identité, coordonnées, liens sociaux, réglages SEO
  services.ts        5 services : slug, titre, accroche, sections, tarif d'entrée
  realisations.ts    projets : slug, client, secteur, années, visuels, récit
  temoignages.ts
  faq.ts             questions/réponses, sert aussi de corpus IA
  legal.ts
```

Chaque fichier est typé en TypeScript et validé par un schéma Zod au build. Un contenu invalide
casse le build, pas la production.

Règle structurante : **ces fichiers sont la seule source**. Les pages les rendent au build,
l'indexation IA les découpe en morceaux. Un tarif modifié se propage à la page et à l'assistant.

## 6. Pages et routage

| Page v5 | Route Next | Remarque |
|---|---|---|
| `index.html` | `/` | prérendu, revalidation à la demande |
| `realisations.html` | `/realisations` | liste depuis `realisations.ts` |
| `projet.html` | `/realisations/vaasam` | route dynamique `[slug]` |
| `services.html` | `/services` | liste |
| `service-*.html` (4) | `/services/[slug]` | un seul gabarit au lieu de 4 fichiers |
| `agents-ia.html` | `/agents-ia` | page longue, simulateur en îlot client |
| `a-propos.html` | `/a-propos` | |
| `mentions-legales.html` | `/mentions-legales` | |
| `404` | `app/not-found.tsx` | |
| `/v5/*` | redirection 301 vers la route équivalente | |

Redirections permanentes depuis les anciennes URL `.html` pour ne pas perdre le référencement.

## 7. Design system et animations

Le CSS est repris tel quel dans un premier temps : les 4 feuilles sont importées globalement,
sans réécriture ni passage à Tailwind. On ne mélange pas migration et refonte visuelle.

Découpage en composants, sans toucher au rendu :

- `components/chrome/Nav.tsx`, `Footer.tsx` : fin de la duplication sur 11 pages
- `components/sections/*` : une section par bloc existant (hero, manifeste, services, travaux, méthode, CTA)
- `components/anim/Reveal.tsx` : un composant client qui remplace l'observateur d'intersection actuel
- `components/anim/HeroPin.tsx` : GSAP isolé dans un composant client avec `gsap.context()` et nettoyage
- `components/anim/SimulateurRoi.tsx` : le simulateur de la page Agents IA, isolé du reste

Règle de performance : GSAP n'est chargé que sur les routes qui en ont besoin, via import dynamique.
Le reste des pages ne embarque aucun JavaScript d'animation.

## 8. Couche IA

### Point de passage unique

`web/lib/ai/` expose une seule interface serveur, quel que soit le fournisseur retenu :

- routage par tâche : modèle local pour la classification et les résumés courts, modèle cloud pour
  le raisonnement et la rédaction commerciale
- streaming SSE vers le client
- comptage des jetons et du coût par requête, journalisé
- aucune clé côté navigateur, aucune clé en dur

### Connaissance et RAG

Ingestion au build : `content/` est découpé en morceaux de 300 à 500 mots, les vecteurs sont
calculés par un modèle d'embedding local et stockés dans Postgres avec pgvector. Aucun appel payant
pour indexer.

À la question d'un visiteur, on récupère les 5 morceaux les plus proches, on les injecte avec
instruction de citer la source interne, et on interdit de répondre au-delà du corpus.

### Outils exposés au modèle

- `rechercher_services(terme)` : tarifs et périmètre
- `creer_prospect(nom, email, besoin, budget, delai)` : écrit dans le CRM, jamais sans confirmation
  explicite du visiteur dans la conversation
- `preparer_devis(prospect_id, prestations)` : crée un brouillon, jamais d'envoi automatique

Chaque outil a un schéma typé, un journal d'appel et un mode simulation utilisable en test.

### Garde-fous, dès le premier jour

- limite de débit par IP et par session
- plafond de coût journalier global, avec coupure et message explicite
- rédaction des données personnelles dans les journaux
- défense contre l'injection de consigne : le contenu récupéré est traité comme donnée, jamais comme instruction
- aucune action irréversible sans validation humaine (envoi de devis, suppression)
- liste de sujets hors périmètre avec réponse de repli

## 9. Données

Postgres 16 avec pgvector, une seule base :

- `conversations`, `messages` : historique, coût par message, note de satisfaction
- `leads` : prospect capté, statut de synchronisation CRM, identifiant distant
- `embeddings` : morceaux, vecteur, chemin source, version de contenu
- `content_versions` : empreinte du contenu indexé, pour réindexer à chaque changement
- `events` : pages vues, départs de formulaire, usage de l'assistant (mesure produit)

SQLite est écarté : les vecteurs, les conversations et les agrégats justifient Postgres, et la
migration ultérieure coûterait plus cher que de partir juste.

## 10. Sécurité

- variables d'environnement validées au démarrage, refus de boot si une clé manque
- secrets uniquement côté serveur, jamais dans un composant client
- en-têtes de sécurité, CSP adaptée au CDN GSAP ou GSAP auto-hébergé (préféré)
- formulaire de contact : protection anti-robot sans service tiers payant, limitation de débit
- données personnelles : minimisation, durée de conservation des conversations documentée

## 11. Déploiement

- `web/Dockerfile` multi-étapes, image `node:22-alpine`, sortie standalone
- Coolify, deux applications sur le même dépôt, variables séparées
- préversion par branche pour relire avant bascule
- bascule : le domaine public passe de FastAPI à Next, `/v5` et `theme/v5` conservés une version
  en rollback, l'admin reste joignable en sous-domaine

## 12. Observabilité

- journaux structurés JSON, un identifiant par requête
- coût IA cumulé par jour et par conversation, visible dans un écran de réglages
- métriques de performance : LCP, CLS, INP, cibles LCP sous 2 s en 4G
- alerte simple si le taux d'erreur des routes IA dépasse 5 %

## 13. Tests

- **Unitaire** : schémas de contenu, utilitaires de tarif, découpage de texte
- **Composants** : rendu des sections clés et navigation (Vitest + Testing Library)
- **Bout en bout** : Playwright sur 6 parcours (accueil, réalisations, projet, service, contact, assistant)
- **Évaluations IA** : un jeu de 25 questions réelles avec réponses attendues et sources citées.
  Toute modification de consigne ou de modèle repasse le jeu. Sans ce filet, aucune garantie de non-régression
- **Performance** : budget Lighthouse en intégration continue, échec si LCP dépasse 2,5 s
- **Accessibilité** : axe sur les pages principales, contraste et navigation clavier

## 14. Lots

**Lot 1, socle** : projet Next, TypeScript strict, CSS repris, layout, Nav, Footer, page d'accueil,
404, redirections, Dockerfile, préversion déployée.
Critère : accueil identique au v5 au pixel près sur desktop et mobile, LCP sous 2 s, zéro erreur console.

**Lot 2, contenu et pages** : couche `content/`, les 10 pages restantes, métadonnées, sitemap,
robots, JSON-LD, images optimisées.
Critère : 11 routes rendues, aucun texte en dur dans les composants, SEO vérifié page par page.

**Lot 3, animations et finitions** : reveals, hero pinné, rail, simulateur ROI, menu mobile,
formulaire de contact fonctionnel.
Critère : parité visuelle et comportementale avec v5, aucune régression de performance.

**Lot 4, socle IA** : Postgres, ingestion, point de passage, assistant de la vitrine, garde-fous,
écran de coût.
Critère : assistant qui répond correctement au jeu de 25 questions, coût journalier plafonné,
aucune clé exposée.

**Lot 5, pont CRM et bascule** : création de prospect, préparation de devis, journalisation,
événements produit, bascule du domaine.
Critère : un visiteur qui décrit un besoin crée un prospect qualifié dans le CRM, sans ressaisie.

## 15. Risques

- **Dérive de périmètre** : la tentation de refaire le design en même temps. Contre-mesure : le CSS
  est gelé au lot 1, toute retouche visuelle passe par une demande séparée
- **Coût IA non maîtrisé** : plafond journalier et routage local par défaut
- **Qualité des réponses** : sans corpus propre, l'assistant générique décrédibilise. Le corpus est
  un livrable du lot 2, pas du lot 4
- **Cohabitation des deux applications** : un seul dépôt, deux déploiements, à documenter dans
  `docs/EXPLOITATION.md` pour éviter les erreurs de racine de build

## 16. Décisions ouvertes, valeurs par défaut retenues

| Sujet | Défaut retenu | Impact si changement |
|---|---|---|
| Domaine de l'admin | `admin.sujeedesign.com`, servi par FastAPI | un sous-domaine à créer, proxy inchangé |
| Base de données | Postgres 16 + pgvector via Coolify | SQLite possible mais migration ultérieure coûteuse |
| Embeddings | modèle local via Ollama | API payante si la qualité locale insuffisante |
| GSAP | auto-hébergé | CDN plus simple mais CSP plus permissive |
| Assistant | bulle discrète, une seule page de conversation | panneau latéral persistant si l'usage le justifie |

## 17. Ce qui n'est pas touché

`app/`, `sujee_editor/`, `theme/templates/`, l'éditeur GrapesJS, les données de production.
Le chantier vitrine est additif jusqu'au lot 5.
