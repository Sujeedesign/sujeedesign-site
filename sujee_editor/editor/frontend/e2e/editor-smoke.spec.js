import { expect, test } from '@playwright/test';

const calls = [];

test.beforeEach(async ({ page }) => {
  calls.length = 0;
  await page.route('**/api/editor/pages/1/visual-project', async (route) => {
    if (route.request().method() === 'PUT') {
      calls.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, draft_version: calls.length }) });
    } else {
      await route.continue();
    }
  });
});

test('registers_all_nineteen_theme_blocks', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await expect(page.locator('#visual-blocks .gjs-block')).toHaveCount(19);
  const types = await page.evaluate(() => window.sjdVisualEditor.Blocks.getAll().map((block) => block.get('id')));
  expect(types).toContain('sjd-section-formulaire-contact');
  expect(types).toContain('sjd-section-chapter');
  const labels = await page.locator('.gjs-block').allTextContents();
  expect(labels.every((label) => !label.includes('HTML'))).toBe(true);
  await expect(page.locator('.gjs-sm-sectors')).toHaveCount(0);
});

test('edits_each_schema_field_kind', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const kinds = new Set();
  for (const block of await page.locator('#visual-blocks .gjs-block').all()) {
    await block.click();
    const current = await page.locator('#visual-section-panel [data-field-kind]').evaluateAll((nodes) => nodes.map((node) => node.dataset.fieldKind));
    current.forEach((kind) => kinds.add(kind));
  }
  expect([...kinds].sort()).toEqual(['bool', 'choice', 'ctas', 'html', 'html-line', 'image', 'images', 'items', 'lines', 'number', 'text', 'textarea'].sort());
});

test('preserves_nested_fields_and_variants_after_reload', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: "Bandeau d'ouverture" }).click();
  await page.locator('#visual-section-panel [data-field-editor="title"]').fill('Accueil de marque');
  await page.locator('#visual-section-panel [data-field-editor="ctas.0.label"]').fill('Découvrir');
  await page.locator('#visual-section-panel [data-field-editor="ctas.0.href"]').fill('/services');
  await page.locator('#visual-section-panel [data-section-variant]').selectOption('page');
  const component = await page.evaluate(() => {
    const model = window.sjdVisualEditor.getWrapper().find('[data-sjd-section="hero"]')[0];
    return JSON.parse(model.getAttributes()['data-sjd-data']);
  });
  expect(component.title).toBe('Accueil de marque');
  expect(component.ctas[0]).toMatchObject({ label: 'Découvrir', href: '/services' });
  expect(component._variant).toBe('page');
  const project = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  await page.evaluate((data) => window.sjdLoadVisualProject(data), project);
  const reloaded = await page.evaluate(() => JSON.parse(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="hero"]')[0].getAttributes()['data-sjd-data']));
  expect(reloaded).toEqual(component);

  await page.route('**/api/editor/media', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ medias: [
      { id: 42, path: 'medias/first.webp', alt: 'Première', mime: 'image/webp' },
      { id: 43, path: 'medias/second.webp', alt: 'Deuxième', mime: 'image/webp' },
    ] }),
  }));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: "Galerie d'images" }).click();
  const addImage = page.locator('#visual-section-panel [data-repeat-path="images"] + .section-repeat-add');
  await addImage.click();
  await page.locator('#visual-section-panel [data-field-editor="images.0.caption"]').fill('Image A');
  await page.locator('#visual-section-panel [data-field-editor="images.0.src"]').selectOption('/medias/first.webp');
  await addImage.click();
  await page.locator('#visual-section-panel [data-field-editor="images.1.caption"]').fill('Image B');
  await page.locator('#visual-section-panel [data-field-editor="images.1.src"]').selectOption('/medias/second.webp');
  await page.getByRole('button', { name: 'Descendre Images 1' }).click();
  const galleryData = await page.evaluate(() => JSON.parse(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="galerie"]')[0].getAttributes()['data-sjd-data']));
  expect(galleryData.images.map((image) => [image.caption, image.src])).toEqual([
    ['Image B', '/medias/second.webp'], ['Image A', '/medias/first.webp'],
  ]);
  const galleryProject = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  await page.evaluate((data) => window.sjdLoadVisualProject(data), galleryProject);
  const galleryReloaded = await page.evaluate(() => JSON.parse(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="galerie"]')[0].getAttributes()['data-sjd-data']));
  expect(galleryReloaded.images).toEqual(galleryData.images);
});

test('keeps_dynamic_blocks_typed', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Grille de réalisations' }).click();
  const root = await page.evaluate(() => window.sjdVisualEditor.getWrapper().find('[data-sjd-section="realisations-grid"]')[0].getAttributes());
  expect(root['data-sjd-data']).toBeTruthy();
  expect(root['data-sjd-data']).not.toContain('<article');
  expect(root['data-sjd-section']).toBe('realisations-grid');
});

test('adds an allowed theme section, edits its content and saves a versioned project', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const blocks = page.locator('#visual-blocks .gjs-block');
  await expect(blocks).toHaveCount(19);
  await blocks.filter({ hasText: 'Chapitre éditorial' }).click();

  const canvas = page.frameLocator('iframe.gjs-frame');
  const section = canvas.locator('[data-sjd-section="chapter"]');
  await expect(section).toBeVisible();
  await expect(section.locator('[data-sjd-field="title"]')).toHaveText('Titre du chapitre');
  await page.locator('#visual-traits select:not(#visual-media-picker)').selectOption('1');
  await expect(section).toHaveClass(/dark/);

  await page.evaluate(() => {
    const title = window.sjdVisualEditor.getWrapper().find('[data-sjd-field="title"]')[0];
    title.set('content', 'Titre modifié');
  });
  await expect(section.locator('[data-sjd-field="title"]')).toHaveText('Titre modifié');
  await page.locator('#visual-save').click();
  await expect(page.locator('#visual-status')).toHaveText('Brouillon enregistré');
  expect(calls).toHaveLength(1);
  const savedProject = calls[0].project;
  expect(savedProject.project_data.styles).toEqual([]);
  expect(JSON.stringify(savedProject)).toContain('Titre modifié');
  expect(JSON.stringify(savedProject)).toContain('sjd-section-chapter');
  await page.evaluate((project) => window.sjdVisualEditor.loadProjectData(project.project_data), savedProject);
  await expect(page.frameLocator('iframe.gjs-frame').locator('[data-sjd-field="title"]'))
    .toHaveText('Titre modifié');
});

test('loads a versioned server project and makes its authored fields editable', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const project = {
    pages: [{ id: 'server-page', frames: [{ id: 'server-frame', component: {
      type: 'wrapper', components: [{ type: 'sjd-section-chapter', tagName: 'section',
        attributes: { class: 's-chap reveal', 'data-sjd-section': 'chapter', 'data-sjd-visible': '1', 'data-sjd-variant': '', 'data-sjd-dark': '0', 'data-sjd-section-id': '12' },
        components: [{ tagName: 'div', attributes: { class: 'container' }, components: [{ tagName: 'div', attributes: { class: 'chap' }, components: [
          { tagName: 'div', attributes: { class: 'chap-head' }, components: [
            { tagName: 'span', attributes: { class: 'type', 'data-sjd-field': 'kicker' }, content: 'Sur-titre' },
            { tagName: 'h2', attributes: { class: 'chap-title', 'data-sjd-field': 'title' }, content: 'Projet chargé' },
          ] },
          { tagName: 'div', attributes: { class: 'chap-body' }, components: [
            { tagName: 'div', attributes: { class: 'chap-rich', 'data-sjd-field': 'body' }, components: [{ tagName: 'p', content: 'Texte déjà publié.' }] },
            { tagName: 'ul', attributes: { class: 'chap-list', 'data-sjd-field': 'list' }, components: [] },
          ] },
        ] }] }],
      }] }, }]}], styles: [], assets: [],
  };
  await page.evaluate((data) => window.sjdLoadVisualProject(data), project);
  const canvas = page.frameLocator('iframe.gjs-frame');
  await expect(canvas.locator('.s-chap .container .chap .chap-title')).toHaveText('Projet chargé');
  const editable = await page.evaluate(() => window.sjdVisualEditor.getWrapper().find('[data-sjd-field="title"]')[0].get('editable'));
  expect(editable).toBe(true);
});

test('publishes only after saving the current draft version', async ({ page }) => {
  let publishedPayload;
  await page.route('**/api/editor/pages/1/visual-project/publish', async (route) => {
    publishedPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ draft_version: 2, project: calls[0].project }),
    });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Chapitre éditorial' }).click();
  await page.locator('#visual-publish').click();
  await expect(page.locator('#visual-status')).toHaveText('Page publiée');
  expect(calls).toHaveLength(1);
  expect(publishedPayload.expected_version).toBe(1);
});

test('offers a confirmed rebase when the classic editor has changed the page', async ({ page }) => {
  let rebasePayload;
  const currentProject = {
    schema_version: 1, theme_id: 'sujee-site', theme_version: 1,
    project_data: { pages: [{ id: 'page', frames: [{ id: 'frame', component: { type: 'wrapper', components: [] } }] }], styles: [], assets: [] },
  };
  await page.route('**/api/editor/pages/1/visual-project/publish', (route) => route.fulfill({
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ error: { rule: 'source_changed', detail: 'Des sections ont changé dans l’éditeur classique.' } }),
  }));
  await page.route('**/api/editor/pages/1/visual-project/rebase', async (route) => {
    rebasePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, project: currentProject, draft_version: 1 }),
    });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-publish').click();
  await expect(page.locator('#visual-rebase')).toBeVisible();
  await page.locator('#visual-rebase').click();
  await expect(page.locator('#visual-status')).toHaveText('Contenu rechargé. Vérifie-le, puis enregistre ou publie.');
  await expect(page.locator('#visual-rebase')).toBeHidden();
  await page.waitForTimeout(1_000); // dépasse la sauvegarde différée et détecte un update parasite après rechargement
  expect(calls).toHaveLength(0);
  expect(rebasePayload).toEqual({ expected_version: 0 });
});

test('keeps the editor controls reachable at mobile, tablet and desktop widths', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.locator('#visual-blocks .gjs-block').first()).toBeVisible();
    await expect(page.locator('#visual-canvas')).toBeVisible();
    await expect(page.locator('#visual-traits')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(width);
    if (width <= 900) {
      const bounds = await page.evaluate(() => ({
        canvasBottom: document.querySelector('#visual-canvas').getBoundingClientRect().bottom,
        traitsTop: document.querySelector('#visual-traits').getBoundingClientRect().top,
      }));
      expect(bounds.traitsTop).toBeGreaterThanOrEqual(bounds.canvasBottom - 1);
    }
  }
});

test('selects a managed media asset for the image section', async ({ page }) => {
  await page.route('**/api/editor/media', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ medias: [{ id: 42, path: 'medias/portfolio.webp', alt: 'Portfolio créatif', mime: 'image/webp' }] }),
  }));
  await page.route('**/medias/portfolio.webp', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>',
  }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Image pleine largeur' }).click();
  await page.evaluate(() => {
    const image = window.sjdVisualEditor.getWrapper().find('[data-sjd-field="src"]')[0];
    window.sjdVisualEditor.select(image);
  });
  const picker = page.locator('#visual-media-picker');
  await expect(picker).toBeVisible();
  await picker.selectOption('42');
  const image = page.frameLocator('iframe.gjs-frame').locator('[data-sjd-field="src"]');
  await expect(image).toHaveAttribute('src', '/medias/portfolio.webp');
  await expect(image).toHaveAttribute('alt', 'Portfolio créatif');
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Citation' }).click();
  await expect(page.frameLocator('iframe.gjs-frame').locator('[data-sjd-section="citation"]')).toHaveCount(1);
});
