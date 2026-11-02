# API contenu et publication

API HTTP du back office, destinée aux agents et aux automatisations. Elle écrit
dans le même stockage que le formulaire d'administration : même validation,
même historique de révisions, même déclenchement de publication.

Base : `https://admin-sujeedesign.145.241.167.66.sslip.io`
(côté vitrine, les mêmes routes existent sous `https://sujeedesign.com/api/admin/…`
pour le back office HTML ; l'API ci-dessous n'est exposée que sur l'origine admin).

## Authentification

```bash
Authorization: Bearer $SITE_API_TOKEN
X-Author: sita            # facultatif, tracé dans les révisions
```

Jeton stocké dans `/opt/data/site-secrets.env` (clé `SITE_API_TOKEN`, fichier 600)
et côté Coolify dans les variables de l'application back office. Sans jeton, ou
avec un jeton invalide : `401`. Si la variable est absente du serveur : `503`.

## Lire

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/content/home
```

Réponse : `{slug, data, custom, updated_at, schema, fields}`.
`fields` liste les chemins modifiables (`path`, `label`, `type`), c'est la
référence pour construire une modification.

## Modifier

Deux formes dans le corps JSON :

* `{"changes": {"hero.title.first": "…"}}` : modification ciblée, les autres
  champs sont conservés ;
* `{"data": {...}}` : document complet (fusionné avec les valeurs par défaut).

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" -H "X-Author: sita" \
  -H "Content-Type: application/json" \
  -d '{"changes": {"hero.title.first": "Studio"}}' \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/content/home
```

* `200` : enregistré, une révision de l'état précédent est créée avant écriture.
* `422` : validation refusée, rien n'est enregistré, le détail nomme le champ.
* `404` : slug inconnu (seul `home` est éditable pour l'instant).

## Catalogue des réalisations

Écrire une fiche sans passer par le formulaire HTML ni par le seed (qui
n'insère que les slugs absents) :

```bash
curl -s -X PUT \
  -H "Authorization: Bearer ***" -H "X-Author: sujee" \
  -H "Content-Type: application/json" \
  -d @fiche.json \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/projets/american-steak-house
```

Le corps reprend la forme d'une entrée de `app/data/catalogue_seed.json` :
`nom`, `client`, `annee`, `ville`, `pitch`, `scope`, `duree`, `ton`, `statut`,
`disciplines`, `tags`, `images[]`, `cover`, `coverPortrait`, `sections[]`,
`results[]`, `position`. Les clés absentes gardent leur valeur en base, donc une
mise à jour de la seule galerie ne touche ni au pitch ni aux sections ;
`"cover": null` retire la couverture, `"slug": "…"` renomme le slug.

Chaque image (`images[]`, `cover`, `coverPortrait`) exige `src` **et**
`width`/`height` : la vitrine réserve la place du visuel, une image en 0 × 0 est
refusée. Réponses : `200` avec `{ok, author, projet, slug_changed, revalidated}`,
`404` slug inconnu, `422` image incomplète ou valeur hors référentiel
(`detail` nomme le champ fautif), `401` sans jeton.

Créer une fiche de zéro :

```bash
curl -s -X POST -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"nom": "Nouveau projet", "statut": "publie", "images": [...]}' \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/projets
```

`nom` obligatoire, slug dérivé du nom (dédoublonné : `-2`, `-3`…) et fiche en
`brouillon` par défaut. `201` en cas de succès.

Les deux points d'écriture terminent par `content_store.notify_site("catalogue")`
pour revalider le cache du site ; `revalidated: false` signifie simplement que
la revalidation n'est pas configurée sur cette instance (pas d'erreur).

## Publier

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/publish
```

Déclenche un déploiement Coolify de l'app Next (`kbt19dmgg3tnm6azvdcvuegg`),
qui reconstruit la vitrine en récupérant le contenu enregistré. `200` avec
`{"ok": true, "deployment": "…"}`, ou `409` si la publication n'est pas
configurée / si Coolify refuse.

`PUT` accepte aussi `"publish": true` pour enchaîner écriture et publication en
un seul appel.

## Statut

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://admin-sujeedesign.145.241.167.66.sslip.io/api/v1/admin/status
```

`{ok, content_updated_at, custom, publish_ready, last_publication}` : utile pour
vérifier qu'un enregistrement a bien été pris en compte et savoir si la
publication est disponible.

## Portée

* Contenu de la page d'accueil (titres, textes, services, réalisations, CTA).
* SEO : titres et descriptions des pages intérieures vivent dans le code Next
  (`web/app/layout.tsx`, `web/components/pages/*`, `web/lib/page-metadata.ts`),
  pas dans cette API. Les modifier demande une modification du dépôt puis un
  déploiement.
* Cette API ne touche ni aux comptes, ni aux messages, ni aux médias.
