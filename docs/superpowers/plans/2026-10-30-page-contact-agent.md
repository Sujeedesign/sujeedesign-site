# Plan · page contact avec agent de qualification

Spec : `docs/superpowers/specs/2026-10-30-page-contact-agent-design.md`
Branche : `feat/contact-agent`

Découpage en lots livrables, chacun testé avant de passer au suivant.

## Lot 1 · socle données

- `app/agent/schema.py` : quatre tables `agent_sessions`, `agent_messages`, `agent_leads`,
  `agent_bookings`, appliquées au démarrage du back office. Migration additive, idempotente,
  `SCHEMA_VERSION` incrémenté.
- `app/agent/store.py` : création et reprise de session, ajout de message, mise à jour des
  champs de qualification, création de lead avec référence `DEM-AAAA-NNNN`, réservation
  idempotente par créneau, purge à 90 jours.
- Tests : `tests/test_agent_store.py`.

## Lot 2 · créneaux et agenda

- `app/agent/slots.py` : génération pure de la grille (lundi-vendredi, 9h-11h et 14h-16h,
  20 min, battement 10 min, délai 48 h, maximum 4 RDV par jour), croisement avec les
  indisponibilités, sélection de 3 propositions.
- `app/agent/google.py` : refresh OAuth, freebusy, création d'événement, envoi Gmail.
  Accès calendrier dédié via variables d'environnement, jamais le jeton maître en production.
- Tests : `tests/test_agent_slots.py` (grille et conflits), `tests/test_agent_google.py`
  avec un faux transport HTTP.

## Lot 3 · agent

- `app/agent/prompt.py` : prompt système verrouillé, 7 champs, interdiction de prix,
  ton, format des questions.
- `app/agent/llm.py` : client Mistral en streaming, boucle d'appels d'outils (4 tours max),
  repli `mistral-small-latest` sur 429 ou 5xx, comptage des tokens.
- `app/agent/tools.py` : `record_fields`, `submit_recap`, `request_slots`, `book_meeting`,
  `save_lead`, `handoff_form`, avec validation serveur.
- `app/agent/engine.py` : machine à états, application des garde-fous, construction des
  événements SSE.
- Tests : `tests/test_agent_engine.py` avec un faux modèle scripté.

## Lot 4 · API

- `app/agent/router.py` : `POST /api/agent/chat` (SSE), `GET /api/agent/session`,
  `POST /api/agent/reset`, `GET /api/agent/health`, `POST /api/agent/lead`.
  Cookie `sjd_conv`, rate limit 5 conversations et 60 messages par heure et par IP,
  plafonds de tours.
- Branchement dans `app/main.py`.
- Tests : `tests/test_agent_api.py` (faux modèle, faux agenda).

## Lot 5 · emails et notifications

- Confirmation au prospect depuis `hello@sujeedesign.com` avec signature.
- Notification Telegram immédiate via `hermes send`, comme `tools/notify_messages.py`,
  dégradation propre si le binaire est absent.
- Brief complet en description de l'événement Google.
- Tests : rendu des messages, échec d'envoi non bloquant.

## Lot 6 · page `/contact`

- `web/app/contact/page.tsx` : metadata, JSON-LD, layout colonne unique.
- `web/components/pages/Contact.tsx` et `ContactChat.tsx` : accroche, chat, progression,
  créneaux, confirmation, formulaire de secours.
- `web/app/api/agent/[...path]/route.ts` ou rewrite `next.config.ts` vers `ADMIN_ORIGIN`.
- Suppression du 301, entrée de menu à la place du `mailto:`.
- Design : jetons existants, blocs sans bulles, index mono, halo, grille de points,
  `aria-live`, `prefers-reduced-motion`, mobile.

## Lot 7 · admin

- Onglet « Demandes » du back office : liste des leads, brief, statut, rendez-vous, filtre
  `a_trier`, bouton archiver.

## Lot 8 · mise en ligne

- Mentions légales : assistant IA, rétention, sous-traitant Mistral.
- Variables d'environnement Coolify, accès Google dédié.
- Recette staging, puis production avec un rendez-vous de test supprimé ensuite.

## Ordre et vérifications

`pytest -q` vert après chaque lot, `npm run build` vert après le lot 6, recette manuelle du
parcours complet avant le lot 8.
