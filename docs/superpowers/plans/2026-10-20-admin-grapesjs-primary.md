# GrapesJS primary admin implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make GrapesJS the only page-content editor for all 19 Sujee section types, while keeping the other admin modules intact.

**Architecture:** Extend the versioned GrapesJS theme adapter and project converter to every type in `DEFAULT_BLOCKS`. Keep versioned drafts in `visual_projects`, publish validated typed sections atomically to the existing Jinja renderer, and migrate pilot projects without data loss. Make `/admin/pages/{id}` open one GrapesJS editor containing section fields, page settings and history; retain Pages, Médias, Messages, Réglages, Redirections and Sauvegarde.

**Tech Stack:** FastAPI, SQLite, Jinja, Python 3.13, GrapesJS Core 0.23.8, Vite, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-admin-grapesjs-primary-design.md`

## Global Constraints

- Support exactly the 19 types in `sujee_editor.blocks.DEFAULT_BLOCKS`.
- Keep `THEME_ID = "sujee-site"`; bump `THEME_VERSION` from 1 to 2; keep `PROJECT_SCHEMA_VERSION = 1` unless the project JSON shape changes.
- Preserve the component IDs for `chapter`, `image-pleine-largeur` and `citation`; new IDs use `sjd-section-<block-name>`.
- Keep GrapesJS drafts private and versioned; publish typed `sections` atomically for Jinja. Never publish GrapesJS HTML/CSS directly.
- Reject unknown components, unsafe rich text, invalid media URLs and arbitrary styles server-side; do not silently drop content.
- Retain page status/deletion in Pages and retain Médias, Messages, Réglages, Redirections and Sauvegarde behavior.
- Never edit or migrate production content during implementation. Production deployment requires a passing isolated staging recipe and separate explicit approval.

## Review Focus

1. **Stored theme-v1 project or invalid stored JSON:** migrate only after validation; preserve project content and version on failure. Test in Task 1 and Task 3.
2. **Nested `LINES`, `ITEMS`, `IMAGES`, `CTAS` values and empty lists:** preserve values, order, defaults and media paths across save/reload. Test in Tasks 1 and 2.
3. **Dynamic blocks (`hero`, `realisations-grid`, `services-list`, `bloc-liens`, `formulaire-contact`):** keep their typed data and Jinja runtime behavior. Test in Tasks 1 and 2.
4. **Untrusted rich text, URLs, attributes and unknown GrapesJS nodes:** reject/sanitize them before persistence or publication. Test in Tasks 1 and 3.
5. **Page settings and an unsaved visual draft during restore:** keep slug/SEO/menu validation and require confirmation before discarding a newer draft. Test in Tasks 3 and 4.

---

### Task 1: Complete the versioned server project contract

**Files:**
- Modify: `sujee_editor/editor/theme.py`
- Modify: `sujee_editor/editor/project.py`
- Test: `tests/test_editor_project.py`
- Test: `tests/editor_fixtures.py`

**Interfaces:**
- Preserve `sections_to_project(sections: Sequence[Mapping[str, Any]]) -> dict[str, Any]` and `project_to_sections(project: Any) -> list[dict[str, Any]]`.
- Add `migrate_project(project: Mapping[str, Any]) -> dict[str, Any]` in `sujee_editor/editor/project.py`. It validates a stored theme-v1 project, retains its component JSON and returns it tagged for theme version 2. It raises `ProjectError` without mutating the input if invalid.
- Define `SUPPORTED_SECTION_TYPES: tuple[str, ...]` in `theme.py` in `DEFAULT_BLOCKS` order; update imports to use this instead of `PILOT_SECTION_TYPES`.

- [ ] **Step 1: Write failing adapter tests**

Add `test_all_nineteen_block_types_round_trip_without_data_loss`, `test_all_block_variants_round_trip_without_data_loss` and `test_migrate_theme_v1_project_preserves_content_and_is_idempotent` to `tests/test_editor_project.py`. Use `DEFAULT_BLOCKS`, `sample_data(block)` and every declared variant. Assert equal section type, stable id, order, variant, visibility, and complete nested `data` after project conversion. Add `test_invalid_theme_v1_project_raises_without_mutation` and assert the input mapping is unchanged.

- [ ] **Step 2: Run the tests and verify the expected failure**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_project.py -k 'all_nineteen or all_block_variants or theme_v1'`
Expected: FAIL because only three component IDs are currently registered and theme-v1 is the only accepted theme version.

- [ ] **Step 3: Implement the server contract**

In `theme.py`, register all 19 stable section-to-component IDs, reverse IDs and `SUPPORTED_SECTION_TYPES`; set `THEME_VERSION = 2` while leaving `PROJECT_SCHEMA_VERSION = 1`. In `project.py`, extend `_component()` and `_section_data()` to preserve all 19 schemas, including variants, repeated nested fields, media values, visibility and section ordering. Keep current IDs for the three existing types. Implement `migrate_project()` as a pure validated copy that only changes the theme version and required supported component metadata.

- [ ] **Step 4: Run the focused adapter tests**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_project.py tests/test_editor_contract.py`
Expected: PASS for every type/variant and all existing unsafe-markup, unsafe-style and invalid-field rejection tests.

- [ ] **Step 5: Commit**

Commit as `feat(editor): map all Sujee sections to GrapesJS`.

### Task 2: Add all 19 visual components and schema-driven field controls

**Files:**
- Create: `sujee_editor/editor/frontend/src/theme-components.js`
- Create: `sujee_editor/editor/frontend/src/section-panel.js`
- Modify: `sujee_editor/editor/frontend/src/theme-plugin.js`
- Modify: `sujee_editor/editor/frontend/src/main.js`
- Modify: `sujee_editor/editor/frontend/src/visual-editor.css`
- Modify: `app/admin.py` (`visual_page_editor` config)
- Test: `sujee_editor/editor/frontend/e2e/editor-smoke.spec.js`

**Interfaces:**
- `registerSujeeTheme(editor, blockSchema) -> void` registers one GrapesJS component and one palette block per server schema entry. `blockSchema` is the serialized `DEFAULT_BLOCKS` mapping passed in `visual-config.blocks`.
- `mountSectionPanel({ root, editor, blockSchema, mediaClient }) -> { refresh, destroy }` renders fields for the selected component and updates only that component’s data; `image` subfields inside `IMAGES` repeaters use the same managed-media picker.
- `theme-components.js` exports `SECTION_COMPONENTS`, keyed by all 19 stable section names. Definitions contain the theme-authored canvas structure and stable component IDs; labels, defaults, variants and field constraints come from `blockSchema`.

- [ ] **Step 1: Write failing browser tests**

Add Playwright tests `registers_all_nineteen_theme_blocks`, `edits_each_schema_field_kind`, `preserves_nested_fields_and_variants_after_reload` and `keeps_dynamic_blocks_typed`. Assert exactly 19 blocks, stable IDs, editing for all `Kind` values (`text`, `textarea`, `html`, `html-line`, `lines`, `items`, `images`, `image`, `bool`, `number`, `choice`, `ctas`), repeater order and media paths after reload; assert there is no generic HTML block or free Style Manager.

- [ ] **Step 2: Run the tests and verify the expected failure**

Run: `npm --prefix sujee_editor/editor/frontend run test:smoke -- --grep 'registers_all_nineteen|edits_each_schema_field_kind|preserves_nested_fields|keeps_dynamic_blocks'`
Expected: FAIL because the current editor registers three blocks and does not render every schema field kind.

- [ ] **Step 3: Pass the typed schema and implement the component panel**

In `app/admin.py::visual_page_editor`, add the serialized editor block schema to `visual-config.blocks`. Implement `SECTION_COMPONENTS`, `registerSujeeTheme()` and `mountSectionPanel()`. Render list and nested item fields as add/remove/reorder controls; use the existing managed-media API for direct and repeated images; render dynamic blocks as typed configuration with a representative preview, never as saved static markup; disable arbitrary markup and styling. Add a route assertion that the authenticated config contains all 19 names and does not expose the config to logged-out requests.

- [ ] **Step 4: Run the browser tests and build**

Run: `npm --prefix sujee_editor/editor/frontend run test:smoke -- --grep 'registers_all_nineteen|edits_each_schema_field_kind|preserves_nested_fields|keeps_dynamic_blocks'` and `npm --prefix sujee_editor/editor/frontend run build`.
Expected: PASS; all 19 blocks register and the production assets build without remote GrapesJS dependencies.

- [ ] **Step 5: Commit**

Commit as `feat(editor): expose the full typed section catalogue`.

### Task 3: Migrate, publish, restore and export full visual projects atomically

**Files:**
- Modify: `sujee_editor/routes.py` (`_ensure_visual_project`, save/publish/rebase/revision routes)
- Modify: `sujee_editor/store/core.py` (`publish_visual_project` and visual-project synchronization)
- Modify: `app/admin.py` (`api_restore`, `api_export`)
- Test: `tests/test_editor_project_routes.py`
- Test: `tests/test_admin.py`

**Interfaces:**
- `_ensure_visual_project(conn, page_id)` migrates and validates a stored v1 row before use. On failure, both JSON columns and `draft_version` remain unchanged.
- Add `Store.synchronize_visual_project(conn, *, page_id: int, expected_version: int, project: Mapping[str, Any]) -> int`. It updates draft and published JSON, theme version and draft version with a compare-and-swap update; it does not commit the caller’s transaction and raises `VersionConflict` on a stale version.
- The page-revision restore route accepts JSON `{expected_visual_version, confirm_discard_draft}`, requires `X-SJD-CSRF`, and returns 403 without a valid token; without confirmation, a divergent visual draft returns 409. A confirmed restore updates page metadata, Jinja sections, and both visual-project JSON copies in the same transaction.
- Each page in `/api/admin/export` includes the existing `sections` plus `visual_project: {schema_version, theme_id, theme_version, draft_version, draft_project, published_project}` when a visual row exists.

- [ ] **Step 1: Write failing store/route tests**

Add `test_visual_project_get_migrates_v1_draft_after_validation`, `test_failed_project_migration_keeps_both_json_columns_unchanged`, `test_publish_all_nineteen_types_is_atomic_and_ordered`, `test_revision_restore_requires_csrf`, `test_restore_with_unsaved_visual_draft_requires_confirmation`, `test_confirmed_restore_updates_sections_and_visual_project_atomically` and `test_export_includes_draft_and_published_visual_project`. Assert invalid/malformed projects leave published sections unchanged; stale versions return 409; missing/invalid restore CSRF returns 403; confirmed restore rebuilds both projects from the restored sections and increments the version exactly once; export retains all prior fields.

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_project_routes.py tests/test_admin.py -k 'migrates_v1 or failed_project_migration or all_nineteen or revision_restore_requires_csrf or unsaved_visual_draft or confirmed_restore or export_includes'`
Expected: FAIL because project migration, all-type publication, revision synchronization and project export are not yet implemented.

- [ ] **Step 3: Implement migration and all-type transactional publish**

Call `migrate_project()` from `_ensure_visual_project()`, update `routes.py` and `store/core.py` to use `SUPPORTED_SECTION_TYPES`, and validate every section before the transaction writes anything. Extend `publish_visual_project()` to materialize all 19 types while retaining current foreign-ID, stale-version, source-conflict and validation checks.

- [ ] **Step 4: Implement restore synchronization and export**

In `api_restore`, parse `{expected_visual_version, confirm_discard_draft}`, verify `X-SJD-CSRF`, begin one transaction, snapshot the current page, restore the chosen revision, rebuild the GrapesJS project from restored section rows, call `Store.synchronize_visual_project()`, and commit only if every operation succeeds. Return 409 if the current draft diverges and the request did not confirm discarding it. Add visual project JSON to the existing export without removing section data.

- [ ] **Step 5: Run focused backend suites**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_project.py tests/test_editor_project_routes.py tests/test_admin.py tests/test_db.py`
Expected: PASS; migrations, stale writes, failed publishes/restores and export preserve consistent project/section data.

- [ ] **Step 6: Commit**

Commit as `feat(editor): preserve full visual projects across publish and restore`.

### Task 4: Put page settings and revision history inside the visual editor

**Files:**
- Create: `sujee_editor/editor/frontend/src/page-settings.js`
- Create: `sujee_editor/editor/frontend/src/revision-panel.js`
- Create: `theme/templates/admin/visual_page.html`
- Modify: `app/admin.py` (`visual_page_editor`, `api_update_page`)
- Modify: `sujee_editor/editor/frontend/src/main.js`
- Modify: `sujee_editor/editor/frontend/src/visual-editor.css`
- Test: `tests/test_editor_visual_page.py`
- Test: `tests/test_admin.py`
- Test: `sujee_editor/editor/frontend/e2e/editor-smoke.spec.js`

**Interfaces:**
- `mountPageSettings({ root, page, savePage, mediaClient }) -> { open, close, destroy }` edits all existing page metadata in one GrapesJS settings drawer.
- `savePage(pageId, patch, csrf) -> Promise<Page>` sends `PATCH /api/admin/pages/{pageId}` with `X-SJD-CSRF`; duplicate slugs remain 409 and do not discard the visual draft.
- `mountRevisionPanel({ root, pageId, getDraftVersion, api }) -> { refresh, destroy }` lists and restores page revisions through the existing revision APIs and requires explicit confirmation before discarding a divergent draft.

- [ ] **Step 1: Add failing API and browser tests**

Add `test_visual_config_contains_all_page_settings_and_csrf`, `test_page_update_requires_valid_csrf`, `test_settings_drawer_saves_metadata_and_keeps_draft_on_slug_conflict`, and `shows_and_restores_page_revisions_with_draft_confirmation`. Assert the panel includes title, slug, type, excerpt, cover/alt, client/year/number, position/categories/external URL, menu fields, SEO, OG image and robots; assert invalid/missing CSRF returns 403; assert duplicate slug returns 409 without altering the visual draft.

- [ ] **Step 2: Run tests and verify the expected failure**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_visual_page.py tests/test_admin.py -k 'page_settings_and_csrf or requires_valid_csrf'` and `npm --prefix sujee_editor/editor/frontend run test:smoke -- --grep 'settings_drawer_saves|restores_page_revisions'`.
Expected: FAIL because the visual payload has only page id/title/path, and the visual UI has no settings or revision panel.

- [ ] **Step 3: Implement the authenticated page settings and revision panels**

Pass `_page_payload()` and the current CSRF token into the visual config. Add CSRF verification to `api_update_page()` using `sujee_editor.tokens.CSRF_HEADER` (`X-SJD-CSRF`) and `verify_csrf`; while the classic screen still exists, also pass a token into its form and make its `admin.js` update request send the same header so intermediate commits remain usable. Implement the settings drawer using existing metadata normalization and media selection. Implement revision list/restore UI using Task 3’s expected-version/confirmation contract. Keep page status and deletion in Pages, not in the section editor; Task 5 removes the temporary classic-form token path with the old screen.

- [ ] **Step 4: Render the editor through a dedicated template**

Move the manual HTML response in `visual_page_editor()` into `theme/templates/admin/visual_page.html`. Preserve JSON escaping for `visual-config` (`<` becomes `\\u003c`), authenticated-only assets, theme styles and accessible page title/status.

- [ ] **Step 5: Run focused checks and commit**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_visual_page.py tests/test_admin.py -k 'page_settings_and_csrf or requires_valid_csrf'`; run `npm --prefix sujee_editor/editor/frontend run test:smoke -- --grep 'settings_drawer_saves|restores_page_revisions'`; run the Vite build.
Expected: PASS; page fields, CSRF, revision confirmation and media picker work from the visual editor. Commit as `feat(editor): add settings and history to visual editor`.

### Task 5: Switch the canonical admin route and retire the duplicate editor UI

**Files:**
- Modify: `app/admin.py` (`page_editor`, `visual_page_editor`)
- Modify: `theme/templates/admin/pages.html` and `theme/templates/admin/tableau_de_bord.html` only if their edit links need adjustment
- Delete or retire: `theme/templates/admin/page.html`
- Modify: `theme/assets/admin.js` (remove page/section editing handlers only)
- Test: `tests/test_admin.py`
- Test: `tests/test_editor_visual_page.py`

**Interfaces:**
- `/admin/pages/{page_id}` is the canonical authenticated GrapesJS editor.
- `/admin/visual/{page_id}` returns 303 to `/admin/pages/{page_id}` after authentication and page validation.
- Page CRUD, preview, status, media, messages, settings, redirects, backup and export routes remain available; retain backend section APIs until a repository-wide reference check proves them unused.

- [ ] **Step 1: Add failing route and regression tests**

Add `test_admin_page_route_renders_grapesjs_without_classic_section_controls`, `test_visual_route_redirects_to_canonical_page_editor`, `test_admin_page_list_edit_link_opens_canonical_route`, `test_pages_module_can_change_page_status`, and `test_non_page_admin_modules_still_render`. Assert `/admin/pages/{id}` contains the GrapesJS config/assets and no `#sectionList`, `#newSectionType` or classic page form; assert `/admin/visual/{id}` redirects; assert Pages still supports publishing/drafting; assert media, messages, settings, redirects and backup views remain reachable.

- [ ] **Step 2: Run route tests and verify the expected failure**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_admin.py tests/test_editor_visual_page.py -k 'admin_page_route_renders or visual_route_redirects or page_list_edit_link or pages_module_can_change or non_page_admin_modules'`
Expected: FAIL because `/admin/pages/{id}` currently renders `page.html` and `/admin/visual/{id}` renders the separate pilot.

- [ ] **Step 3: Implement the single edit route**

Extract the visual HTML/config builder into a shared authenticated helper; make `page_editor()` render `visual_page.html`; make `visual_page_editor()` redirect to the canonical page URL. Keep `/admin/pages` row links pointed at the canonical route and move the existing draft/publish action onto each Pages row so status management stays in Pages. Remove old page/section form handlers and their now-unused template; retain every `admin.js` function still used by page status, media, messages, settings, redirects, revisions and other admin screens.

- [ ] **Step 4: Run route and admin regression suites**

Run: `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_admin.py tests/test_editor_visual_page.py tests/test_editor_routes.py`
Expected: PASS; no parallel section editor is rendered and other admin endpoints and screens continue to work.

- [ ] **Step 5: Commit**

Commit as `feat(admin): use GrapesJS for page editing`.

### Task 6: Verify the full editorial workflow and accessibility

**Files:**
- Modify: `sujee_editor/editor/frontend/e2e/editor-smoke.spec.js`
- Modify: `tests/test_editor_project_routes.py`
- Modify: `tests/test_editor_visual_page.py`
- Modify: `tests/test_admin.py`

- [ ] **Step 1: Add the composed all-types save/reload/publish test**

Add Playwright test `adds_all_types_and_round_trips_a_single_visual_project`. With the 19-block schema, add all blocks to one canvas in `DEFAULT_BLOCKS` order, assert each stable component ID and count, save using the versioned endpoint mock, reload its returned project, and assert order and nested fields are unchanged. Add backend test `test_published_all_types_render_through_jinja_without_draft_leak`: publish one valid section of each type, request the public page without an admin session, assert Jinja-rendered sections appear in order and draft-only text does not. Existing Tasks 2-5 cover individual controls, metadata, revisions, security and canonical routes.

- [ ] **Step 2: Run the focused acceptance tests**

Run: `npm --prefix sujee_editor/editor/frontend run test:smoke -- --grep 'adds_all_types_and_round_trips_a_single_visual_project'`; `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q tests/test_editor_project_routes.py::test_published_all_types_render_through_jinja_without_draft_leak`.
Expected: FAIL before implementation if a type cannot be serialized/reloaded or public rendering leaks a draft; retain the failing type/content in assertion output.

- [ ] **Step 3: Correct any acceptance-test defect in its owning task**

Correct component registration or serialization in Task 2; correct Jinja conversion or draft isolation in Task 3. Do not bypass validators, relax project limits, or hide errors.

- [ ] **Step 4: Run all local quality gates**

Run: `npm --prefix sujee_editor/editor/frontend run build`; `npm --prefix sujee_editor/editor/frontend run test:smoke`; `/opt/data/sujeedesign-site/.venv/bin/python -m pytest -q -m 'not e2e'`; `docker build -t sujeedesign-admin-grapesjs-check .`.
Expected: all four commands pass, including the full Python suite, browser smoke suite and production image build.

- [ ] **Step 4: Commit the final acceptance tests**

Commit as `test(editor): cover complete GrapesJS admin workflow`.

### Task 7: Document and validate the isolated staging cutover

**Files:**
- Modify: `docs/EXPLOITATION.md`
- Create: `docs/development/grapesjs-admin-cutover.md`
- Test: `tests/test_editor_visual_page.py` only if an operational contract needs an executable assertion

- [ ] **Step 1: Document the new admin contract and rollback**

Document `/admin/pages/{id}` as the sole page editor, `/admin/visual/{id}` as a redirect, theme version 2 and all supported block types, export/restore behavior, private drafts, Jinja rendering and rollback to the prior application image without rewriting content.

- [ ] **Step 2: Validate on isolated staging data**

On an isolated staging app and sanitized content snapshot, load every stored page through the v2 adapter; assert every section is represented, then exercise save/reload/publish/restore and compare public Jinja output. Verify Media, Messages, Réglages, Redirections, Sauvegarde and page status still function. Stop if any page cannot be imported losslessly; leave production data untouched.

- [ ] **Step 3: Run final checks and commit**

Run `git diff --check`, inspect the full change set, rerun Task 6 gates and confirm staging health. Commit as `docs: document GrapesJS admin cutover and rollback`.

## Dependencies and completion gate

- Task 1 precedes Tasks 2 and 3.
- Tasks 2 and 3 precede Tasks 4 and 5.
- Task 4 and Task 5 precede Task 6.
- Task 6 precedes Task 7 and any staging cutover.
- Complete only when all 19 types round-trip and render, theme-v1 projects migrate safely, all page settings and revisions remain available in GrapesJS, the classic section UI is absent, non-page admin modules still work, CI/build/browser/backend checks pass and the isolated staging recipe is clean.
- Production rollout is not part of this plan. Request and verify separate explicit approval after presenting the staging result.
