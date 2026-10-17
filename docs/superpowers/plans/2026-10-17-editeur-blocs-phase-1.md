# Éditeur de blocs, phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Éditer le site en place (clic sur un bloc, écriture dans un brouillon, publication), avec l'éditeur déjà livré sous forme de paquet réutilisable `sujee_editor`.

**Architecture:** Un paquet Python `sujee_editor` vit à la racine du dépôt (extrait en dépôt séparé en phase 3) : `blocks/` déclare les 19 types de blocs (schéma, libellés, gabarit), `store/` lit et écrit le brouillon/publication/révisions dans la base SQLite du site, `routes/` expose `/api/editor/*`, `editor/` porte les fichiers statiques et l'accroche de gabarit. Le site consomme le paquet dès maintenant : `app/sections.py` devient un adaptateur du registre, le rendu ajoute une enveloppe par bloc et marque les nœuds éditables par `data-field`, `/admin` reste en place pour le reste de l'exploitation.

**Tech Stack:** Python 3.13, FastAPI, Jinja2, SQLite (sqlite3), JavaScript natif (modules ES), pytest, Browser Use (Chrome DevTools Protocol).

**Spec:** `docs/superpowers/specs/2026-10-17-editeur-blocs-design.md`

## État d'exécution (17 octobre, fin de journée)

**Tasks 1 à 13 : faites, vérifiées, committées.** `80146af` (registre typé + `app/sections.py` en adaptateur), `f6a4c76` (validation), `045b01a` (colonnes de brouillon), `0d10df5` (store), `1de6617` (enveloppes et brouillon en mode édition), `c606059` (API : session, CSRF, brouillon, structure, publication, médias), `f2b7360` (accroche + canevas), `4aa58ba` (marquage des 19 gabarits et contrat par variante).

**Task 14 : faite** (`9e183ee`). Sous 900 px, le rail et le panneau sont deux vues plein écran ouvertes une à la fois par une barre d'outils (Blocs, Ce bloc, Page) ; cibles 44 px ; la hauteur réelle de la barre est publiée dans `--sjd-bar-h` pour que les vues ne la recouvrent jamais.

**Task 15 : vérifiée sur une instance locale** (`tools/editor_recette.py`, base de recette, port 8124) :

- `pytest -q -m "not e2e"` : 334 passés. `pytest -q tests/test_e2e_browser.py -m e2e` contre l'instance locale : 4 passés.
- Parcours navigateur réel (Chrome DevTools Protocol) : édition en place d'un titre, brouillon côté serveur, visiteur qui ne voit jamais le brouillon (avec ou sans `?edit=1`), publication, visiteur qui voit la nouvelle valeur, restauration d'une révision en brouillon, republication.
- Rail : déplacement, duplication (copie juste après l'original, masquée et en brouillon), masquage (bloc absent en public, grisé dans le canevas), suppression, ajout d'un bloc par la palette.
- Refus vérifiés : `409` version dépassée, `400` champ inconnu et texte trop long, `403` sans jeton CSRF, `404` bloc d'une autre page ou page inconnue, `401` sans session ; la valeur précédente reste intacte dans tous les cas.
- Débordement horizontal : aucun à 375, 768 et 1280 px sur six routes, en public comme en édition.
- Design verrouillé : hauteurs de bandeau identiques avant/après au pixel sur six pages et trois fenêtres (595 px en 1440x900, 629 en 1920x1080), un seul `h1` dans `<main>`.

**Écarts assumés par rapport au plan, et pourquoi**

1. Contrat du hero vérifié **par variante** : la variante `accueil` n'affiche par design ni sur-titre, ni introduction, ni lien de retour, donc l'union des variantes est la seule exigence tenable sans inventer des nœuds sur la page d'accueil publiée.
2. `formulaire_contact` : la colonne latérale s'affiche dès qu'elle a un titre ou des colonnes (`{% if columns or aside_title %}`), sinon `test_contact_aside_is_optional` tombait.
3. Les nœuds rendus vides des champs éditables sont masqués par une règle `:empty` dans `theme/assets/site-extras.css` au lieu d'être supprimés : ils restent ciblables pour l'édition en place, sans reprendre les 28 à 48 px de marge qu'ils consommaient.
4. Les blocs masqués sont rendus **en mode édition** (opacité 0,55), pas en public : un bloc ajouté naît masqué, il doit rester visible dans le canevas sinon l'ajout paraît sans effet.
5. L'API est portée par `sujee_editor/routes.py` avec des chemins qualifiés par la page (`/api/editor/pages/<page>/sections/<bloc>`) : un bloc d'une autre page répond `404` sans effet de bord.
6. « Ajouter un bloc » pose le bloc en fin de page ; on le déplace ensuite avec les flèches du rail.

**Points ouverts, non bloquants**

- Après une restauration de révision, tout le snapshot passe en brouillon : les blocs inchangés sont marqués « en brouillon ». Cosmétique (le statut annonce 10 modifications).
- `/a-propos` déborde de 5 px en 320 px (frise « Parcours »), **déjà avant ce chantier** ; les largeurs de référence du thème (375 px et au-dessus) sont propres.
- 1280x720 mesure 565 px aujourd'hui contre 569 px dans la note du 17 octobre : identique avant et après ce chantier, donc écart de contexte de mesure et non régression.

## Global Constraints

- Aucune couleur, taille de police, coin ou espacement en dur : uniquement les jetons du thème (`--fs-*`, `--radius-*`, couleurs existantes). Un test refuse toute `font-size` hors échelle (`tests/test_harmonisation.py`).
- Les 19 types de blocs existants et leurs gabarits ne changent pas : mêmes noms, mêmes champs, mêmes variantes, même HTML. Le registre du paquet reprend la liste de `app/sections.py`, il n'en invente pas.
- Discipline demandée aux gabarits : `data-field="<nom du champ>"` sur les nœuds des champs éditables en place, présent même quand la valeur est vide.
- Le brouillon n'est jamais servi à un visiteur : la session admin est vérifiée côté serveur, `?edit=1` sans session valide est ignoré.
- Aucune écriture dans les données publiées avant `POST .../publish` (transaction unique, révision de page créée, brouillons vidés).
- Session admin existante réutilisée : cookie `sjd_admin` (HMAC, secret `SESSION_SECRET`), TTL 12 h ; plus un jeton CSRF `editor` par session dans l'en-tête `X-SJD-CSRF` ; contrôle de l'en-tête `Origin` sur toute écriture ; `noindex,nofollow` déjà posé sur `/admin`.
- Les enveloppes de blocs ne modifient ni le design ni l'accessibilité : 595 px de hauteur de bandeau en 1440x900, 569 en 1280x720, 629 en 1920x1080 ; contraste titre ≥ 4,5:1 ; un seul `h1`, dans `<main>`.
- Les 172 tests actuels restent verts, plus les tests ajoutés par ce plan.
- Médias : écrits dans le volume du site (`media_dir`, `/data/medias`), jamais dans l'image de conteneur ; extensions et tailles vérifiées.
- Pas de multi-utilisateurs, pas de rôles, pas de publication bloc par bloc, pas de glisser-déposer en phase 1 : hors périmètre.
- Le JavaScript de l'éditeur est servi par le paquet (`/assets/editor/*`), jamais inline dans un gabarit du site.
- Gestion des pages (créer, renommer, menu, réglages de page, supprimer) : elle reste dans `/admin` en phase 1. Les écrans « pages » et « sections » de l'admin ne sont retirés qu'après la phase qui les reprend, jamais avant.
- Déploiement : recette d'abord et vérification de ce qui est réellement servi ; la production attend une demande explicite distincte.

## Review Focus

- **Brouillon servi en public** : session absente, cookie forgé ou expiré, `?edit=1` dans l'URL, accès direct par un robot → la page publiée seulement, jamais le brouillon, ni dans le HTML, ni dans `/sitemap.xml`, ni dans le JSON-LD.
- **Conflit d'écriture** : deux onglets ouverts, l'un écrit après l'autre → refus `409`, aucune valeur écrasée, l'onglet retardataire propose de recharger.
- **Écriture refusée** : champ inconnu du bloc, valeur trop longue, obligatoire manquant, mauvais type → `400` avec le champ et la règle, et la valeur précédente reste intacte en base (aucune écriture partielle).
- **Bloc d'une autre page** : identifiant de section inexistant, non numérique, ou appartenant à une autre page → `404`/`400` sans aucun effet de bord sur une autre page.
- **Design verrouillé après les enveloppes** : les hauteurs de bandeaux, les contrastes, l'unique `h1` dans `<main>` et l'absence de style embarqué restent identiques une fois les enveloppes posées.

---

### Task 1: Paquet `sujee_editor` : registre de blocs typé et adaptateur du site

**Files:**
- Create: `sujee_editor/__init__.py`, `sujee_editor/blocks/__init__.py`, `sujee_editor/blocks/types.py`, `sujee_editor/blocks/catalogue.py`
- Modify: `app/sections.py`
- Test: `tests/test_editor_blocks.py`

**Interfaces:**
- Produces: `Kind` (enum de valeurs `text`, `textarea`, `html`, `html-line`, `lines`, `items`, `images`, `image`, `bool`, `number`, `choice`, `ctas`), `Field(name, kind, label, required=False, max_length=None, choices=(), fields=(), default=None, inplace=None)` avec `field.form_type` (`html` pour `RICH`/`RICH_LINE`, `items` pour `CTAS`/`ITEMS`, sinon la valeur de `kind`) et `field.inplace` (explicite, sinon `kind in {TEXT, TEXTAREA, RICH, RICH_LINE, IMAGE}`) ; `Block(name, label, fields, template, variants={}, repeatable=True)` avec `block.field(name)` et `block.inplace_fields` ; `DEFAULT_BLOCKS: dict[str, Block]` (19 types, ordre de `SECTION_ORDER`) ; `get_block(name) -> Block | None`.
- Consumes: rien du site.

- [ ] **Step 1: Écrire les tests d'équivalence avec l'ancien registre**

```python
def test_catalogue_has_the_nineteen_legacy_types():
    assert list(DEFAULT_BLOCKS) == list(sections.SECTION_ORDER)
    assert len(DEFAULT_BLOCKS) == 19

def test_legacy_registry_shape_is_unchanged():
    hero = sections.SECTION_TYPES["hero"]
    assert hero["label"] == "Bandeau d'ouverture"
    assert hero["variants"]["accueil"].startswith("Accueil")
    assert [f["name"] for f in hero["fields"]][:3] == ["kicker", "title", "intro"]
    assert hero["fields"][0]["type"] == "text"

def test_form_type_maps_rich_line_to_html():
    assert Field("title", Kind.RICH_LINE, "Titre").form_type == "html"
    assert Field("ctas", Kind.CTAS, "Boutons").form_type == "items"

def test_every_block_template_exists():
    for block in DEFAULT_BLOCKS.values():
        assert (render_module.TEMPLATES_DIR / block.template).is_file()
```

- [ ] **Step 2: Lancer les tests pour constater l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_blocks.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sujee_editor'`

- [ ] **Step 3: Écrire `types.py`, puis `catalogue.py` en reprenant champ par champ `app/sections.py`**

Les sous-champs de `items`/`images`/`ctas` sont des tuples de `Field` (`Field("images", Kind.IMAGES, "Images", fields=(Field("src", Kind.IMAGE, "Fichier"), ...))`). Deux marquages `inplace=False` explicites : `banniere.svg` et `chapter.list` (le premier est du SVG collé, le second est une liste). `hero.cover`, `hero.image`, `galerie.images`, `logos-clients.logos` restent `inplace=False` en phase 1 (édités au panneau) ; les champs texte et image simples sont `inplace=True`.

- [ ] **Step 4: Réécrire `app/sections.py` en adaptateur**

`SECTION_TYPES` est construit depuis `DEFAULT_BLOCKS` : `{"label": block.label, "variants": dict(block.variants), "fields": [{"name": f.name, "label": f.label, "type": f.form_type, **extras} for f in block.fields]}` où `extras` reprend `choices`, `fields` (sous-dicts au même format) et `default` quand ils existent. `registry()`, `template_for()`, `default_value()`, `default_data()`, `defaults_for()`, `SECTION_ORDER`, `TEMPLATE_BY_TYPE` gardent leurs signatures et leurs sorties actuelles.

- [ ] **Step 5: Vérifier que rien n'a bougé dans le site**

Run: `.venv/bin/python -m pytest -q -m "not e2e"`
Expected: PASS, 172 tests + les nouveaux

- [ ] **Step 6: Commit**

```bash
git add sujee_editor app/sections.py tests/test_editor_blocks.py
git commit -m "feat(editor): registre de blocs typé, app/sections.py en adaptateur"
```

### Task 2: Validation dérivée du schéma

**Files:**
- Create: `sujee_editor/blocks/validate.py`
- Test: `tests/test_editor_validation.py`

**Interfaces:**
- Produces: `ValidationError(field: str, rule: str, detail: str = "")`, `validate_data(block: Block, data: dict) -> list[ValidationError]`, `validate_field(block: Block, name: str, value: Any) -> list[ValidationError]`.
- Règles, valeurs exactes de `rule` : `unknown_field`, `required`, `max_length`, `not_a_number`, `not_a_bool`, `bad_choice`, `bad_variant`, `bad_item` (sous-champ invalide, `detail` = `"items[2].title"`), `too_many` (`max_items` sur les listes).
- Les clés commençant par `_` autres que `_variant` sont ignorées par la validation et conservées telles quelles.

- [ ] **Step 1: Écrire les tests**

```python
def test_unknown_field_and_max_length():
    errors = validate_data(hero, {"title": "x" * 500, "inconnu": 1})
    assert {e.field for e in errors} == {"inconnu", "title"}
    assert {e.rule for e in errors} == {"unknown_field", "max_length"}

def test_required_and_variant():
    assert [e.rule for e in validate_data(chapter, {}) if e.field == "title"] == []
    assert [e.rule for e in validate_data(hero, {"_variant": "nope"})] == ["bad_variant"]

def test_nested_items_report_the_item_path():
    errors = validate_data(faq, {"items": [{"q": "Question", "a": "Réponse"}, {"q": 12}]})
    assert [(e.field, e.rule) for e in errors] == [("items", "bad_item")]
    assert errors[0].detail == "items[1].q"
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_validation.py`
Expected: FAIL, `ImportError: cannot import name 'validate_data'`

- [ ] **Step 3: Implémenter `validate.py`**

Une fonction par `Kind` dans une table de correspondance. La validation ne lève jamais d'exception : elle retourne la liste complète des erreurs, pour que le panneau affiche tous les champs fautifs d'un coup.

- [ ] **Step 4: Vérifier**

Run: `.venv/bin/python -m pytest -q tests/test_editor_validation.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sujee_editor/blocks/validate.py tests/test_editor_validation.py
git commit -m "feat(editor): validation dérivée du schéma de bloc"
```

### Task 3: Colonnes de brouillon et migration idempotente

**Files:**
- Modify: `app/db.py`
- Test: `tests/test_db.py`

**Interfaces:**
- Produces: `SCHEMA_VERSION = 2`, `migrate(conn) -> list[str]` (liste des colonnes ajoutées), appelée par `init_db(conn)`. Colonnes ajoutées à `sections` : `draft TEXT` (NULL = pas de brouillon), `draft_version INTEGER NOT NULL DEFAULT 0`.

- [ ] **Step 1: Écrire les tests**

```python
def test_migration_adds_draft_columns_to_an_existing_db(tmp_path):
    conn = db.connect(tmp_path / "site.db")
    conn.executescript(LEGACY_SCHEMA_V1)      # schéma figé, sans colonnes de brouillon
    conn.execute("INSERT INTO sections (page_id, position, type, data) VALUES (1, 0, 'chapter', '{}')")
    assert db.migrate(conn) == ["draft", "draft_version"]
    assert {row["name"] for row in conn.execute("PRAGMA table_info(sections)")} >= {"draft", "draft_version"}

def test_migrate_is_idempotent(tmp_path):
    conn = db.connect(tmp_path / "site.db")
    db.init_db(conn)
    assert db.migrate(conn) == []
    assert db.get_meta(conn, "schema_version") == "2"
```

`LEGACY_SCHEMA_V1` est le bloc `CREATE TABLE sections` actuel, recopié dans le test : c'est la seule façon de prouver qu'une base de production migre.

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_db.py`
Expected: FAIL, `AttributeError: module 'app.db' has no attribute 'migrate'`

- [ ] **Step 3: Implémenter la migration**

`migrate` lit `PRAGMA table_info(sections)` et ajoute chaque colonne manquante par `ALTER TABLE sections ADD COLUMN`, dans l'ordre déclaré, puis met à jour `schema_version`. Le `SCHEMA` garde `CREATE TABLE IF NOT EXISTS` avec les deux colonnes pour les bases neuves ; les données publiées ne sont jamais touchées.

- [ ] **Step 4: Vérifier**

Run: `.venv/bin/python -m pytest -q tests/test_db.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/db.py tests/test_db.py
git commit -m "feat(db): colonnes de brouillon et migration idempotente"
```

### Task 4: Store du paquet : état, écriture, publication, révisions

**Files:**
- Create: `sujee_editor/store/__init__.py`, `sujee_editor/store/core.py`
- Test: `tests/test_editor_store.py`

**Interfaces:**
- Produces: `Store(db_path, blocks: dict[str, Block])` avec `connect()`, `require_tables(conn)`, `page_state(conn, page_id) -> PageState`, `effective_data(section) -> dict`, `write_field(conn, *, section_id, field, value, expected_version) -> SectionState`, `write_draft(conn, *, section_id, data, expected_version) -> SectionState`, `add_section(conn, *, page_id, type, variant, position) -> SectionState`, `move_section(conn, *, section_id, offset) -> None`, `duplicate_section(conn, *, section_id) -> SectionState`, `toggle_section(conn, *, section_id) -> SectionState`, `delete_section(conn, *, section_id) -> None`, `publish(conn, *, page_id, author="sujee") -> dict`, `revisions(conn, page_id) -> list[dict]`, `restore(conn, *, page_id, revision_id) -> PageState` ; dataclasses `SectionState(id, type, variant, label, visible, position, data, draft, draft_version, revised)` et `PageState(page, sections, revisions)` ; exceptions `UnknownPage`, `UnknownSection`, `UnknownRevision`, `VersionConflict(current)`, `ValidationFailed(errors)`, `StoreNotReady`.
- Contrat conservé : `publish` écrit une ligne `revisions` dont le `snapshot` a exactement la forme de `app.repo.snapshot_page` (`{"page": {...}, "sections": [{...}]}`), pour que l'écran de révisions de l'admin actuel continue de fonctionner.

- [ ] **Step 1: Écrire les tests**

```python
def test_write_field_only_touches_the_draft(store, conn, page_id):
    section = first_section(conn, page_id)
    state = store.write_field(conn, section_id=section["id"], field="title", value="Nouveau", expected_version=0)
    assert state.draft_version == 1 and state.revised is True
    assert json.loads(read(conn, section["id"])["data"])["title"] != "Nouveau"
    assert store.effective_data(read(conn, section["id"]))["title"] == "Nouveau"

def test_stale_version_is_refused(store, conn, page_id):
    section_id = first_section(conn, page_id)["id"]
    store.write_field(conn, section_id=section_id, field="title", value="A", expected_version=0)
    with pytest.raises(store_module.VersionConflict):
        store.write_field(conn, section_id=section_id, field="title", value="B", expected_version=0)
    assert store.effective_data(read(conn, section_id))["title"] == "A"

def test_unknown_field_writes_nothing(store, conn, page_id):
    section = first_section(conn, page_id)
    with pytest.raises(store_module.ValidationFailed) as exc:
        store.write_field(conn, section_id=section["id"], field="fantome", value="x", expected_version=0)
    assert exc.value.errors[0].rule == "unknown_field"
    assert read(conn, section["id"])["draft"] is None

def test_publish_copies_draft_creates_revision_and_clears_drafts(store, conn, page_id):
    ...
    assert published["revision_id"] > 0
    assert store.effective_data(read(conn, section_id))["title"] == "Nouveau"
    assert read(conn, section_id)["draft"] is None
    assert repo_restore_compatible(store.revisions(conn, page_id)[0])

def test_restore_writes_into_the_draft_only(store, conn, page_id):
    ...
    assert store.effective_data(read(conn, section_id))["title"] == "Ancien"
    assert json.loads(read(conn, section_id)["data"])["title"] == "Nouveau"
```

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_store.py`
Expected: FAIL, `ModuleNotFoundError: No module named 'sujee_editor.store'`

- [ ] **Step 3: Implémenter `store/core.py`**

`require_tables` refuse de démarrer si `pages`, `sections`, `medias` ou `revisions` manquent (`StoreNotReady` avec la liste des tables absentes). Les écritures de brouillon ne touchent pas `_meta.content_revision` (le HTML publié n'est pas invalidé sans raison) ; `publish` incrémente la révision une seule fois, après la transaction. `restore` réapplique la structure du snapshot en conservant les identifiants de sections qui existent encore et écrit toutes les valeurs dans `draft`, jamais dans `data`.

- [ ] **Step 4: Vérifier**

Run: `.venv/bin/python -m pytest -q tests/test_editor_store.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sujee_editor/store tests/test_editor_store.py
git commit -m "feat(editor): store de brouillon, publication et révisions"
```

### Task 5: Marquer les nœuds éditables et verrouiller le contrat de schéma

**Files:**
- Modify: `theme/templates/sections/*.html` (19 gabarits)
- Create: `tests/editor_fixtures.py`, `tests/test_editor_contract.py`

**Interfaces:**
- Produces: `tests/editor_fixtures.py` avec `sample_data(block) -> dict` (chaque champ rempli, une entrée par liste) et `empty_data(block) -> dict` (valeurs vides) ; `data_fields(html_text) -> set[str]`.
- Consumes: `DEFAULT_BLOCKS`, `render_module.build_env()`, `render_module.section_html`.

- [ ] **Step 1: Écrire le test de contrat**

```python
@pytest.mark.parametrize("name", list(DEFAULT_BLOCKS))
def test_declared_inplace_fields_are_marked_in_the_template(name):
    block = DEFAULT_BLOCKS[name]
    expected = {f.name for f in block.inplace_fields}
    for data in (sample_data(block), empty_data(block)):
        html = render_section(name, data)
        assert data_fields(html) == expected, f"{name}: marquage des champs incohérent"

def test_no_marker_for_a_field_that_is_not_declared():
    assert "data-field" not in render_section("banniere", sample_data(DEFAULT_BLOCKS["banniere"]))
```

Le marqueur se pose sur le nœud extérieur du champ (le `h1`, le `p`, la `figure`, le `div` qui porte la valeur), pas sur un nœud conditionnel : il doit être présent aussi quand la valeur est vide, sinon le test échoue.

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_contract.py`
Expected: FAIL, marquage absent sur les 19 gabarits

- [ ] **Step 3: Poser `data-field` dans les 19 gabarits, un gabarit par étape**

Ne rien déplacer d'autre dans le HTML : seul un attribut est ajouté sur les nœuds déjà existants. Après chaque gabarit :

Run: `.venv/bin/python -m pytest -q tests/test_editor_contract.py tests/test_render.py tests/test_harmonisation.py -k "$nom_du_bloc or harmon"`

- [ ] **Step 4: Vérifier que le site rend exactement pareil**

Run: `.venv/bin/python -m pytest -q -m "not e2e"`
Expected: PASS, 172 tests + contrat

- [ ] **Step 5: Commit**

```bash
git add theme/templates/sections tests/editor_fixtures.py tests/test_editor_contract.py
git commit -m "feat(theme): marquer les nœuds éditables des blocs et verrouiller le contrat"
```

### Task 6: Enveloppes de blocs, brouillon en mode édition, page publique intacte

**Files:**
- Modify: `app/render.py`, `app/public.py`
- Test: `tests/test_editor_render.py`

**Interfaces:**
- Produces: `section_context(section, *, edit=False)` (en mode édition, `data` = brouillon effectif et `version` = `draft_version`) ; `section_html(env, section, ctx, *, envelopes=True)` (enveloppe `<div class="sjd-block" data-block-id data-block-type data-block-label data-block-visible>`) ; `render_page(..., envelopes=True, use_cache=True)` (jamais de cache en mode édition) ; `env_is_editor(request, conn) -> bool` dans `app/public.py`, avec `ctx["editor_enabled"]` et `ctx["editor"]` (charge utile JSON : `page_id`, `path`, `csrf`, `blocks`, `sections`).
- Consumes: `Store.page_state`, `Store.effective_data`.

- [ ] **Step 1: Écrire les tests**

```python
def test_visitor_never_receives_a_draft(client, conn, page_slug):
    write_draft_value(conn, page_slug, "title", "Brouillon secret")
    for url in (f"/{page_slug}", f"/{page_slug}?edit=1"):
        assert "Brouillon secret" not in client.get(url).text
    assert "editor.js" not in client.get(f"/{page_slug}?edit=1").text

def test_editor_session_receives_the_draft(client, conn, page_slug, admin_cookie):
    write_draft_value(conn, page_slug, "title", "Brouillon secret")
    html = client.get(f"/{page_slug}?edit=1", cookies=admin_cookie).text
    assert "Brouillon secret" in html and "editor.js" in html

def test_envelope_only_adds_the_envelope(conn, page_id):
    with_envelopes = render_page(ENV, page=page, sections=sections, ctx=ctx)
    without = render_page(ENV, page=page, sections=sections, ctx=ctx, envelopes=False)
    assert unwrap_and_strip_data(with_envelopes) == without
    assert with_envelopes.count('class="sjd-block"') == len(visible_sections)
```

`unwrap_and_strip_data` retire les `<div class="sjd-block" ...>` (ouverture et fermeture) et les attributs `data-*`, puis compare les deux chaînes.

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_render.py`
Expected: FAIL, brouillon servi au visiteur avec `?edit=1`, aucune enveloppe

- [ ] **Step 3: Implémenter dans `render.py`**

L'enveloppe est posée dans `render_page`, au même endroit pour toutes les pages, jamais dans les 19 gabarits. Elle est émise pour tout le monde (visiteur compris) : le HTML public et le HTML d'édition ont exactement la même structure de document, seul le contenu diffère en mode édition.

- [ ] **Step 4: Implémenter dans `public.py`**

`?edit=1` est ignoré si la session admin est absente ou invalide (`security.verify_session`) ; en mode édition, le rendu n'utilise pas le cache et la charge utile `editor` est construite depuis `Store.page_state`. Le JSON-LD et le `sitemap.xml` continuent de lire les données publiées uniquement.

- [ ] **Step 5: Vérifier la non-régression du rendu et du référencement**

Run: `.venv/bin/python -m pytest -q -m "not e2e"`
Expected: PASS, 172 tests + rendu ; en particulier `tests/test_a11y.py`, `tests/test_seo.py` et `tests/test_harmonisation.py` restent verts

- [ ] **Step 6: Commit**

```bash
git add app/render.py app/public.py tests/test_editor_render.py
git commit -m "feat(render): enveloppes de blocs et brouillon réservé à la session"
```

### Task 7: Router du paquet : session, CSRF, routes de contenu

**Files:**
- Create: `sujee_editor/routes/__init__.py`, `sujee_editor/routes/api.py`, `sujee_editor/routes/security.py`
- Test: `tests/test_editor_routes.py`

**Interfaces:**
- Produces: `build_router(store, *, session_secret, cookie_name="sjd_admin", session_ttl=12*60*60) -> APIRouter`. Le site le monte sur `/api/editor`. Routes et réponses :
  - `GET /pages/{page_id}/state` → `{page, sections, blocks, revisions, csrf}` (`blocks` = schéma sérialisé : `name`, `label`, `variants`, `fields`)
  - `PATCH /sections/{section_id}` corps `{field, value, expected_version}` → `{section}`
  - `PUT /sections/{section_id}/draft` corps `{data, expected_version}` → `{section}`
  - `POST /sections/{section_id}/move` corps `{offset: -1|1}` ; `POST /sections/{section_id}/duplicate` ; `POST /sections/{section_id}/toggle` ; `DELETE /sections/{section_id}`
  - `POST /pages/{page_id}/sections` corps `{type, variant, position}` → `{section}`
  - `POST /pages/{page_id}/publish` → `{revision_id, published_at, sections}`
  - `GET /pages/{page_id}/revisions` ; `POST /pages/{page_id}/restore/{revision_id}` → `{sections}`
- Codes : `400` validation (`{error: {field, rule, detail}}`), `401` session absente/expirée, `403` origine ou CSRF refusé, `404` page/section/révision inconnue, `409` `{error: {rule: "version", current}}` + état courant.
- Consumes: `Store`, `validate_data`.

- [ ] **Step 1: Écrire les tests sur une app minimale**

```python
@pytest.fixture
def api(tmp_path, seeded_db):
    app = FastAPI()
    app.include_router(build_router(store, session_secret="test-secret"), prefix="/api/editor")
    return TestClient(app, cookies={"sjd_admin": make_session("test-secret")}, headers=CSRF_HEADERS)

def test_write_requires_a_session_and_a_csrf_token(seeded_db):
    client = TestClient(minimal_app(seeded_db))
    assert client.patch(f"/api/editor/sections/{sid}", json={"field": "title", "value": "x", "expected_version": 0}).status_code == 401
    client.cookies.set("sjd_admin", make_session("test-secret"))
    assert client.patch(f"/api/editor/sections/{sid}", json={...}).status_code == 403   # CSRF absent

def test_write_from_another_origin_is_refused(api):
    assert api.patch(f"/api/editor/sections/{sid}", json={...}, headers={"origin": "https://mechant.example"}).status_code == 403

def test_stale_write_returns_409_with_the_current_state(api):
    api.patch(f"/api/editor/sections/{sid}", json={"field": "title", "value": "A", "expected_version": 0})
    response = api.patch(f"/api/editor/sections/{sid}", json={"field": "title", "value": "B", "expected_version": 0})
    assert response.status_code == 409 and response.json()["error"]["rule"] == "version"

def test_section_of_another_page_is_not_reachable(api, other_page_section_id):
    assert api.patch(f"/api/editor/sections/{other_page_section_id}", json={...}).status_code == 404

def test_non_numeric_section_id_is_rejected(api):
    assert api.patch("/api/editor/sections/abc", json={...}).status_code == 422

def test_validation_error_names_the_field_and_rule(api):
    response = api.patch(f"/api/editor/sections/{sid}", json={"field": "kicker", "value": "x" * 200, "expected_version": 0})
    assert response.status_code == 400 and response.json()["error"]["rule"] == "max_length"
```

Les routes de section vérifient que la section appartient bien à la page visée par la session de travail (l'identifiant de page est passé en corps ou en en-tête `X-SJD-Page`), et refusent `404` sinon.

- [ ] **Step 2: Lancer pour voir l'échec**

Run: `.venv/bin/python -m pytest -q tests/test_editor_routes.py`
Expected: FAIL, routes inexistantes (404 partout)

- [ ] **Step 3: Implémenter `routes/security.py`**

`require_session` (cookie `sjd_admin` vérifié avec le secret fourni, même format HMAC que le site), `require_csrf` (en-tête `X-SJD-CSRF` = jeton signé de purpose `editor`, TTL de session), `check_origin` (mêmes règles que `app/admin.py` : écriture refusée si `Origin` ne contient pas l'hôte). Le paquet n'importe rien du site.

- [ ] **Step 4: Implémenter `routes/api.py`**

Chaque écriture passe par `Store` (donc par la validation dérivée du schéma) et ne renvoie jamais un état optimiste : la réponse contient l'état tel qu'il est en base après l'écriture.

- [ ] **Step 5: Vérifier**

Run: `.venv/bin/python -m pytest -q tests/test_editor_routes.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add sujee_editor/routes tests/test_editor_routes.py
git commit -m "feat(editor): API d'édition avec session, CSRF et contrôle d'origine"
```

### Task 8: Médias du paquet

**Files:**
- Create: `sujee_editor/routes/media.py`
- Test: `tests/test_editor_media.py`

**Interfaces:**
- Produces: `GET /media` → `{medias: [{id, filename, path, alt, mime, width, height, size}]}`, `POST /media` (multipart `file`, `alt` facultatif) → `{media}`, `DELETE /media/{media_id}` → `{ok: true}`. Extensions autorisées : `.jpg .jpeg .png .webp .avif .svg .gif .pdf` ; taille maximale 8 Mio ; écriture sous `media_dir` avec un nom aléatoire, jamais dans le dépôt.

- [ ] **Step 1: Écrire les tests** : envoi d'un PNG valide (ligne `medias` créée, fichier présent dans `media_dir`), extension refusée (`.php` → `400`), fichier trop gros (`413`), suppression (fichier et ligne retirés), et une écriture sans CSRF refusée (`403`).

- [ ] **Step 2: Lancer pour voir l'échec**. Run: `.venv/bin/python -m pytest -q tests/test_editor_media.py`

- [ ] **Step 3: Implémenter `routes/media.py`** en reprenant les règles et la validation de `app/admin.py::api_upload` (mimes, extension, dimensions via Pillow quand c'est une image), sans importer le module du site.

- [ ] **Step 4: Vérifier**. Run: `.venv/bin/python -m pytest -q tests/test_editor_media.py -v`

- [ ] **Step 5: Commit**

```bash
git add sujee_editor/routes/media.py tests/test_editor_media.py
git commit -m "feat(editor): médias du paquet (liste, envoi, suppression)"
```

### Task 9: Accroche de l'éditeur dans le site

**Files:**
- Create: `sujee_editor/editor/__init__.py`, `sujee_editor/editor/templates/editor/head.html`, `sujee_editor/editor/templates/editor/bootstrap.html`, `sujee_editor/editor/static/editor.css`, `sujee_editor/editor/static/editor.js` (squelette), `tools/editor_recette.py`
- Modify: `sujee_editor/__init__.py` (classe `Editor`), `app/render.py` (`build_env` avec `ChoiceLoader`), `app/main.py`, `theme/templates/base.html`
- Test: `tests/test_editor_bootstrap.py`

**Interfaces:**
- Produces: `Editor(*, db_path, templates, media_dir, blocks, session_secret, cookie_name="sjd_admin")` exposant `.router`, `.assets` (dossier statique), `.templates_dir` ; `build_env` charge les gabarits du site **puis** ceux du paquet ; `head.html` (dans `<head>`) et `bootstrap.html` (avant les scripts de fin) ne rendent rien sans `editor_enabled` ; le bouton « Modifier » est un lien `?edit=1`, rendu seulement avec une session valide et hors mode édition ; le JSON `#sjd-editor-data` porte `page_id`, `path`, `csrf`, `blocks`, `sections`.
- Consumes: `Store`, `build_router`, `DEFAULT_BLOCKS`.

- [ ] **Step 1: Écrire les tests**

```python
def test_public_page_has_no_editor_traces(client, page_slug):
    html = client.get(f"/{page_slug}").text
    assert "editor.js" not in html and "Modifier" not in html and "sjd-editor-data" not in html

def test_session_sees_the_modify_button_but_not_the_editor_yet(client, page_slug, admin_cookie):
    html = client.get(f"/{page_slug}", cookies=admin_cookie).text
    assert 'href="?edit=1"' in html and "editor.js" not in html

def test_edit_mode_loads_the_editor_with_the_schema(client, page_slug, admin_cookie):
    html = client.get(f"/{page_slug}?edit=1", cookies=admin_cookie).text
    assert "/assets/editor/editor.js" in html and "/assets/editor/editor.css" in html
    payload = json.loads(re.search(r'id="sjd-editor-data" type="application/json">(.*?)</script>', html, re.S).group(1))
    assert payload["csrf"] and len(payload["blocks"]) == 19 and payload["page_id"] > 0
```

- [ ] **Step 2: Lancer pour voir l'échec**. Run: `.venv/bin/python -m pytest -q tests/test_editor_bootstrap.py`

- [ ] **Step 3: Écrire la classe `Editor`, les deux gabarits d'accroche et le montage dans `main.py`**

`main.py` construit l'éditeur avec `settings_module.db_path()`, `theme/templates`, `media_root`, `DEFAULT_BLOCKS` et `security.session_secret()`, puis monte le routeur sur `/api/editor` et les fichiers statiques sur `/assets/editor`. Le cache de rendu est invalidé au démarrage par la migration, comme aujourd'hui.

- [ ] **Step 4: Écrire `tools/editor_recette.py`**

Outil de vérification locale : construit l'app avec une base scratch (par défaut `/opt/data/profiles/raj/cache/scratch/editor-recette/site.db`), y sème `seed/content.json`, lance uvicorn sur `--port 8124` (défaut) et affiche l'URL. Le mot de passe admin n'est jamais affiché : il vient de l'environnement.

- [ ] **Step 5: Vérifier au navigateur et en tests**

Run: `.venv/bin/python tools/editor_recette.py` puis Browser Use sur `http://127.0.0.1:8124/`
Expected: page publique sans trace d'éditeur ; après connexion sur `/admin/connexion`, le bouton « Modifier » apparaît ; `?edit=1` charge `editor.css` et `editor.js` et pose les enveloppes `sjd-block`.

Run: `.venv/bin/python -m pytest -q -m "not e2e"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add sujee_editor app/render.py app/main.py theme/templates/base.html tools/editor_recette.py tests/test_editor_bootstrap.py
git commit -m "feat(editor): accroche de l'éditeur dans le site et outil de recette locale"
```

### Task 10: Canevas : sélection, édition en place, écriture en brouillon

**Files:**
- Create: `sujee_editor/editor/static/api.js`, `sujee_editor/editor/static/canvas.js`, `sujee_editor/editor/static/state.js`
- Modify: `sujee_editor/editor/static/editor.js`, `sujee_editor/editor/static/editor.css`
- Test: parcours navigateur sur la recette locale (aucun runner JS dans ce dépôt)

**Interfaces:**
- Produces: `api.js` : `patch(path, body)`, `put(path, body)`, `post(path, body)`, `del(path)` (en-têtes `X-SJD-CSRF`, `Origin` implicite, `credentials: "same-origin"`) et `ApiError(status, payload)` ; `state.js` : `state = {pageId, csrf, blocks, sections, selectedId, status}` avec `applySection(section)`, `markDirty(id)`, `setStatus(text)` ; `canvas.js` : délégation de clic sur `[data-block-id]` (sélection), double-clic sur `[data-field]` (édition en place), `Escape` (annuler), `Entrée` hors champ multiligne (valider).

- [ ] **Step 1: Écrire d'abord le scénario navigateur attendu**

Sur `/a-propos?edit=1` avec session : cliquer un bloc → il prend la classe `is-selected` et le rail le surligne ; double-cliquer le titre (`[data-field="title"]`) → `contenteditable="true"` et curseur dans le titre ; taper « Titre de recette » puis `Entrée` → un `PATCH /api/editor/sections/<id>` part, la barre d'état passe à « Modifié » ; recharger `?edit=1` → le titre de recette est toujours là (il vient du brouillon) ; ouvrir la même page sans session → l'ancien titre publié est servi.

- [ ] **Step 2: Vérifier que le scénario échoue** (aucun de ces comportements n'existe) : Browser Use, mêmes URLs, attendu : aucun bloc sélectionnable, aucun `PATCH` émis.

- [ ] **Step 3: Implémenter `api.js` et `state.js`**

Une erreur réseau ou un `400`/`409`/`401` ne doit jamais laisser croire à une écriture réussie : `canvas.js` restaure la valeur précédente et affiche le message renvoyé par le serveur.

- [ ] **Step 4: Implémenter `canvas.js` et le style d'édition**

Liseré discret sur les blocs (`outline` d'un pixel, jeton de couleur du thème, jamais de style littéral), étiquette du bloc au survol (`data-block-label`), `is-selected` sur la sélection, `is-dirty` quand un brouillon existe. Le double-clic n'active `contenteditable` que si le champ est déclaré `inplace` côté serveur (la charge utile ne contient que ceux-là).

- [ ] **Step 5: Rejouer le scénario au navigateur**

Run: `.venv/bin/python tools/editor_recette.py` puis Browser Use
Expected: tout le scénario de l'étape 1 au vert, y compris « le visiteur voit encore l'ancien titre ».

- [ ] **Step 6: Commit**

```bash
git add sujee_editor/editor/static
git commit -m "feat(editor): sélection des blocs et édition du texte en place"
```

### Task 11: Panneau du bloc généré par le schéma

**Files:**
- Create: `sujee_editor/editor/static/panel.js`, `sujee_editor/editor/static/fields.js`, `sujee_editor/editor/static/media-picker.js`
- Modify: `sujee_editor/editor/static/editor.css`
- Test: parcours navigateur (formats de champs, erreurs de validation, sélecteur de médias)

**Interfaces:**
- Produces: `panel.js` : `renderPanel(section)` construit les champs depuis `state.blocks[section.type].fields` ; `fields.js` : un rendu par `kind` (`text`, `textarea`, `html`, `html-line`, `lines`, `items`, `images`, `image`, `bool`, `number`, `choice`, `ctas`) ; `media-picker.js` : liste `GET /api/editor/media`, envoi `POST /api/editor/media`.
- Représentations de valeurs identiques à l'admin actuel (`theme/assets/admin.js`) : `lines` = liste de chaînes, `items`/`images`/`ctas` = liste d'objets, `bool` = 0/1, `number` = entier, `html`/`html-line` = HTML nettoyé côté serveur.

- [ ] **Step 1: Écrire le scénario** : sélectionner un bloc « Chapitre », modifier le sur-titre (texte), le corps (HTML), ajouter une puce (`lines`), changer un item de `ctas` (libellé, lien, style), basculer `dark` (bool) → après chaque écriture, recharger `?edit=1` et constater la valeur conservée ; saisir un sur-titre de 200 caractères → message d'erreur sur le champ, valeur précédente rétablie dans le panneau et dans le canevas.

- [ ] **Step 2: Vérifier l'échec** (panneau vide) : Browser Use, attendu : aucun panneau.

- [ ] **Step 3: Implémenter `fields.js`** (un rendu par type, aucune liste de champs codée en dur) puis `panel.js`

Les écritures de champ simple passent par `PATCH` ; les listes (`lines`, `items`, `images`, `ctas`) passent par `PUT .../draft` avec la version attendue. Les deux routes sont déjà écrites et testées (Task 7).

- [ ] **Step 4: Implémenter `media-picker.js`** et brancher les champs `image`/`images`

- [ ] **Step 5: Rejouer le scénario au navigateur** (dont l'erreur de validation) : Browser Use

- [ ] **Step 6: Commit**

```bash
git add sujee_editor/editor/static
git commit -m "feat(editor): panneau de bloc généré par le schéma"
```

### Task 12: Rail des blocs et palette d'ajout

**Files:**
- Create: `sujee_editor/editor/static/rail.js`, `sujee_editor/editor/static/palette.js`
- Modify: `sujee_editor/editor/static/editor.css`
- Test: parcours navigateur

**Interfaces:**
- Produces: `rail.js` : liste ordonnée des blocs (libellé + type), sélection, monter/descendre (`POST /move`), dupliquer (`POST /duplicate`), masquer/afficher (`POST /toggle`), supprimer avec confirmation nommant le bloc (`DELETE`) ; `palette.js` : « Ajouter un bloc » groupé par famille depuis `state.blocks`, insertion à la position choisie (`POST /pages/{id}/sections`) puis rechargement sur l'ancre `#sjd-block-<id>`.
- Après une écriture structurelle, l'état local est jeté et la page est rechargée en mode édition : le canevas réaffiche ce que le serveur a réellement enregistré (jamais de rendu optimiste).

- [ ] **Step 1: Écrire le scénario** : monter le 3e bloc d'A-propos, constater l'ordre après rechargement ; dupliquer un bloc puis supprimer la copie (confirmation) ; masquer un bloc → il disparaît du canevas, reste listé et visible à l'édition, et la page publique ne le contient plus ; ajouter un bloc « Citation » en 2e position → il apparaît à cette position en brouillon, absent de la page publique.

- [ ] **Step 2: Vérifier l'échec** : Browser Use, attendu : aucun rail.

- [ ] **Step 3: Implémenter `rail.js`** puis `palette.js`

- [ ] **Step 4: Rejouer le scénario au navigateur**, plus la vérification « le visiteur ne voit ni le bloc masqué ni le bloc ajouté »

- [ ] **Step 5: Commit**

```bash
git add sujee_editor/editor/static
git commit -m "feat(editor): rail des blocs et palette d'ajout"
```

### Task 13: Publier, révisions, indicateur d'état, erreurs 401 et 409

**Files:**
- Create: `sujee_editor/editor/static/statusbar.js`
- Modify: `sujee_editor/editor/static/editor.js`, `sujee_editor/editor/static/state.js`, `sujee_editor/editor/static/api.js`
- Test: parcours navigateur (publication, restauration, conflit, session expirée)

**Interfaces:**
- Produces: `statusbar.js` : « Modifié », « brouillon non publié », « publié il y a X minutes » (depuis `page.published_at` et `updated_at`), bouton « Publier » (`POST /pages/{id}/publish` puis rechargement), menu « Revenir à… » (`GET /pages/{id}/revisions` puis `POST /pages/{id}/restore/{revision_id}` puis rechargement), liste des blocs en brouillon.
- 401 : canevas en lecture seule, bandeau « session expirée, se reconnecter » avec lien vers `/admin/connexion?next=<chemin>?edit=1` ; les écritures non abouties sont conservées dans `localStorage` sous `sjd-editor-pending-<page_id>` et rejouées après reconnexion.
- 409 : bandeau « la page a changé dans un autre onglet » avec bouton « Recharger » ; aucune écriture, aucun rechargement automatique.

- [ ] **Step 1: Écrire le scénario** : modifier un titre, vérifier que le visiteur voit encore l'ancien ; publier → le visiteur voit le nouveau, une révision apparaît dans « Revenir à… » ; restaurer la révision précédente → l'ancien titre revient **en brouillon** (le visiteur voit toujours le publié) ; publier → le visiteur voit l'ancien titre.

- [ ] **Step 2: Écrire le scénario d'erreur** : deux onglets `?edit=1` sur la même page, écrire dans le premier, écrire dans le second avec une version dépassée → message « la page a changé », valeur du premier intacte en base (vérifié par `GET /api/editor/pages/<id>/state`) ; vider le cookie de session puis écrire → lecture seule, message de reconnexion, aucune perte de la saisie locale.

- [ ] **Step 3: Vérifier l'échec** : Browser Use, attendu : pas de barre d'état, pas de publication possible.

- [ ] **Step 4: Implémenter `statusbar.js` et la reprise après reconnexion**

- [ ] **Step 5: Rejouer les deux scénarios au navigateur**

- [ ] **Step 6: Commit**

```bash
git add sujee_editor/editor/static
git commit -m "feat(editor): publication, révisions et gestion des conflits"
```

### Task 14: Écrans étroits : panneau plein écran, pas d'édition en place

**Files:**
- Modify: `sujee_editor/editor/static/editor.js`, `sujee_editor/editor/static/panel.js`, `sujee_editor/editor/static/rail.js`, `sujee_editor/editor/static/editor.css`
- Test: parcours navigateur aux largeurs 320, 375, 768 et 1280 px

**Interfaces:**
- Produces: sous 900 px (`matchMedia("(max-width: 899px)")`), le double-clic n'active pas `contenteditable`, le panneau occupe tout l'écran, le rail s'ouvre en tiroir, la barre d'état reste accessible ; cibles tactiles ≥ 44 px ; aucun défilement horizontal du document.

- [ ] **Step 1: Écrire le scénario** : en 375 px sur `/a-propos?edit=1`, sélectionner un bloc par le rail, modifier son titre dans le champ du panneau, publier ; mesurer `document.documentElement.scrollWidth == window.innerWidth` sur les quatre largeurs, sur les six sections.

- [ ] **Step 2: Implémenter le comportement étroit** dans le CSS et les modules JS

- [ ] **Step 3: Rejouer le scénario et les mesures** au navigateur (CDP `Emulation.setDeviceMetricsOverride`)

- [ ] **Step 4: Commit**

```bash
git add sujee_editor/editor/static
git commit -m "feat(editor): édition confortable sur écran étroit"
```

### Task 15: Vérification intégrée et déploiement en recette

**Files:**
- Modify uniquement les fichiers que les échecs constatés désignent
- Test: `.venv/bin/python -m pytest -q -m "not e2e"`, parcours navigateur, mesures verrouillées

- [ ] **Step 1: Tests complets**

Run: `.venv/bin/python -m pytest -q -m "not e2e"`
Expected: PASS, 172 tests d'origine + les nouveaux ; tout blocage d'environnement est noté, jamais masqué

- [ ] **Step 2: Parcours navigateur complet sur la base locale**

Run: `.venv/bin/python tools/editor_recette.py` puis Browser Use sur les six sections (`/`, `/realisations`, une réalisation, `/services`, `/a-propos`, `/contact`) : sélectionner, modifier, publier, recharger en visiteur, restaurer
Expected: aucune écriture optimiste, un seul `h1` dans `<main>` en mode édition, aucun brouillon servi sans session

- [ ] **Step 3: Mesures de design verrouillées**

Browser Use : hauteurs de bandeau 595 px (1440x900), 569 px (1280x720), 629 px (1920x1080) ; contraste du titre de bandeau ≥ 4,5:1 par échantillonnage sur le fond animé ; `grep -o '@keyframes *[a-z-]*' theme/assets/site.css | sort | uniq -c` sans doublon
Expected: valeurs identiques à celles du 17 octobre, aucune régression

- [ ] **Step 4: Diff et dépôt**

Run: `git diff --check && git status --short && git diff --stat`
Expected: aucune erreur d'espace, seuls les fichiers prévus ont changé

- [ ] **Step 5: Déployer la recette et vérifier ce qui est réellement servi**

Run: `git push origin main` puis déploiement Coolify de `sujeedesign-site-staging` (`zxb1kdvv8qqbukxhsvsi7aq1`), suivi jusqu'à `status: finished`, lecture du commit construit, puis `curl -s <url-recette>/api/health` et recherche de `/assets/editor/editor.js` dans la page en mode édition
Expected: la recette sert bien le nouveau code ; la production n'est pas touchée

- [ ] **Step 6: Bilan à Sujee**

Nombre de tests réellement passés, ce qui reste bloqué, ce qui n'a pas été déployé, et le feu vert à demander pour la production.

## Dependencies and sequencing

- Task 1 précède tout le reste (registre et adaptateur).
- Task 2 précède Task 4 (le store valide par le schéma).
- Task 3 précède Task 4 (les colonnes de brouillon).
- Task 4 précède Tasks 6, 7 et 8.
- Task 5 précède Task 6 (les marqueurs avant l'enveloppe, sinon le contrat n'a rien à vérifier).
- Task 7 précède Tasks 8 à 13 (l'interface ne parle qu'à l'API).
- Task 9 précède Tasks 10 à 14 (sans accroche, pas de canevas).
- Tasks 10 → 11 → 12 → 13 s'enchaînent dans cet ordre ; Task 14 après la 13.
- Task 15 en dernier. Aucun déploiement de production dans ce plan.
