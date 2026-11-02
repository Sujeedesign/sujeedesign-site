# Sécurité — état au 2 novembre 2026

Audit mené sur le back office FastAPI (`app/`) et le site Next (`web/`).
Docker n'étant pas pilotable depuis ce shell, l'audit s'est fait par lecture du
code, tests automatisés et appels HTTP sur la prod.

## Corrigé

- **CSRF lié à la session.** Le jeton de formulaire est signé avec la session
  admin (`_csrf_key`). Un jeton volé ou rejoué hors de sa session est invalide,
  et `check_csrf` refuse toute requête sans `current_user` (403). La déconnexion
  reste possible avec une session expirée (cookies toujours effacés).
- **Jeton de synchronisation en en-tête uniquement.** Le paramètre `?token=`
  fuitait dans les journaux d'accès et l'historique du proxy.
- **Uploads vérifiés par octets magiques.** `security.sniff_matches()` remplace
  la confiance au `Content-Type` : un HTML renommé en `.png` est refusé (415).
  Branché sur les deux chemins d'upload (formulaire `/admin/medias` et API).
- **Médias servis inertes.** `/medias/*` renvoie
  `Content-Security-Policy: default-src 'none'; sandbox` et `nosniff` : un SVG
  ou un HTML déposé dans le dossier ne peut pas exécuter de script depuis
  l'origine du back office.
- **IP client fiable.** `client_ip_from()` retient le dernier saut public de
  `X-Forwarded-For` (le premier est écrit par le client). Utilisé par le
  formulaire de contact, le chat (parcours en tête) et l'API admin. Le hachage
  d'IP est salé par `SESSION_SECRET`.
- **Limite de corps de requête.** 1 Mo pour les formulaires et l'API, 16 Mo
  pour les imports de médias (413 au-delà).
- **Bourrage de jeton API.** 40 essais par 15 minutes et par IP sur
  `Authorization: Bearer`.
- **En-têtes durcis.** HSTS, `Permissions-Policy`, `X-Frame-Options`,
  `nosniff`, `no-store` sur `/admin` et `/api`, côté back office ; le site
  ajoute `Referrer-Policy`, `Permissions-Policy` et `frame-ancestors` limité au
  back office (l'aperçu d'édition doit rester possible).
- **`X-Author` nettoyé.** L'en-tête est déclaratif (jeton partagé) : les
  caractères de contrôle sont retirés pour ne pas injecter de fausses lignes
  dans les journaux.
- **Contenu CMS.** Les `href` `javascript:`, `data:`, `vbscript:` venant de la
  base sont neutralisés à la lecture (`contactLinks`), comme les anciens
  `mailto:`.

## Tests

`pytest tests -q` : 137 tests verts, 2 échecs préexistants sur le ton des
messages de l'agent (`test_agent_engine.py`), identiques sur `HEAD` avant audit.
`web` : `tsc --noEmit`, 28 tests, build verts.

## Reste à décider (non bloquant, hors code)

- **API exposée sur `admin-sujeedesign.145.241.167.66.sslip.io`** : nom d'hôte
  en IP nue, pas de WAF. Restreindre par IP ou passer derrière un nom de
  domaine propre serait un vrai gain.
- **Jeton admin unique et partagé** : pas de comptes nominatifs, donc pas
  d'audit par personne au-delà de `X-Author`. Des comptes séparés ou un SSO
  régleraient ça.
- **CSP complète sur le site** : nécessite des nonces Next et une passe sur les
  scripts inline ; à faire à froid, pas en correctif de sécurité.
- **Sauvegardes** : vérifier la restauration réelle de `atelier.db`, pas
  seulement la copie.
