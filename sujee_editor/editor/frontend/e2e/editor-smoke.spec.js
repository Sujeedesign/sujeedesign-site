import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const calls = [];

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

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
  await page.route('**/api/admin/pages/1/visual-preview', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const payload = route.request().postDataJSON();
    const components = payload.project?.project_data?.pages?.[0]?.frames?.[0]?.component?.components || [];
    const sections = components.map((component, position) => {
      const attrs = component.attributes || {};
      let data = {};
      try { data = JSON.parse(attrs['data-sjd-data'] || '{}'); } catch { /* fixture fallback */ }
      const section = attrs['data-sjd-section'] || 'chapter';
      const title = escapeText(data.title || 'Titre de chapitre');
      const darkClass = data.dark ? ' dark' : '';
      return `<div class="sjd-block" data-block-id="${attrs['data-sjd-section-id'] || 0}" data-block-type="${section}" data-block-position="${position}"><section class="s-chap reveal${darkClass}"><h2>${title}</h2></section></div>`;
    }).join('');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html lang="fr"><head><link rel="stylesheet" href="/src/demo-theme.css"></head><body><main>${sections}</main></body></html>`,
    });
  });
});

test('registers_all_twenty_theme_blocks', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await expect(page.locator('#visual-blocks .gjs-block')).toHaveCount(20);
  const types = await page.evaluate(() => window.sjdVisualEditor.Blocks.getAll().map((block) => block.get('id')));
  expect(types).toContain('sjd-section-formulaire-contact');
  expect(types).toContain('sjd-section-chapter');
  const labels = await page.locator('.gjs-block').allTextContents();
  expect(labels.every((label) => !label.includes('HTML'))).toBe(true);
  await expect(page.locator('.gjs-sm-sectors')).toHaveCount(0);
});

test('renders the server preview and selects the corresponding section', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Chapitre éditorial' }).click();
  const preview = page.frameLocator('#visual-live-preview');
  await expect(preview.locator('.s-chap h2')).toHaveText('Titre de chapitre');
  await preview.locator('.sjd-block').click();
  await expect.poll(() => page.evaluate(() => window.sjdVisualEditor.getSelected()?.getAttributes()['data-sjd-section'])).toBe('chapter');
});

test('deletes the selected section only after confirmation and saves the draft', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const before = await page.evaluate(() => window.sjdVisualEditor.getWrapper().components().length);
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Chapitre éditorial' }).click();
  const afterAdd = await page.evaluate(() => window.sjdVisualEditor.getWrapper().components().length);
  expect(afterAdd).toBe(before + 1);

  const preview = page.frameLocator('#visual-live-preview');
  await preview.locator(`.sjd-block[data-block-position="${afterAdd - 1}"]`).click();
  const remove = page.getByRole('button', { name: 'Supprimer cette section' });
  await expect(remove).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await remove.click();
  await expect.poll(() => page.evaluate(() => window.sjdVisualEditor.getWrapper().components().length)).toBe(afterAdd);

  page.once('dialog', (dialog) => dialog.accept());
  await remove.click();
  await expect.poll(() => page.evaluate(() => window.sjdVisualEditor.getWrapper().components().length)).toBe(before);
  await expect(page.locator('#visual-status')).toHaveText('Brouillon enregistré', { timeout: 5000 });
  await expect.poll(() => calls.at(-1)?.project?.project_data?.pages?.[0]?.frames?.[0]?.component?.components?.length ?? 0).toBe(before);
});

test('edits a section background with an animated gradient or a custom color', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Chapitre éditorial' }).click();
  const panel = page.locator('#visual-section-panel');
  const background = panel.locator('[data-field-editor="section_background"]');
  const color = panel.locator('[data-field-editor="section_background_color"]');
  await expect(background.locator('option[value="gradient"]')).toHaveText('Dégradé animé');
  await expect(color).toBeHidden();

  await background.selectOption('gradient');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.sjdVisualEditor.getSelected().getAttributes()['data-sjd-data']).section_background)).toBe('gradient');
  await background.selectOption('custom');
  await expect(color).toBeVisible();
  await color.fill('#123456');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.sjdVisualEditor.getSelected().getAttributes()['data-sjd-data']).section_background_color)).toBe('#123456');
});

test('composes a section with bounded columns, theme colors and a local background image', async ({ page }) => {
  await page.route('**/api/editor/media', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ medias: [{ id: 77, path: 'medias/background.webp', alt: 'Fond', mime: 'image/webp' }] }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.locator('#visual-blocks .gjs-block').filter({ hasText: 'Section à composer' }).click();
  const panel = page.locator('#visual-section-panel');
  const addColumn = panel.locator('[data-repeat-path="columns"] + .section-repeat-add');
  await addColumn.click();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.sjdVisualEditor.getSelected().getAttributes()['data-sjd-data']).columns.map((column) => column.span))).toEqual(['4', '4', '4']);
  await panel.locator('[data-repeat-path="columns.0.elements"] + .section-repeat-add').click();
  await panel.locator('[data-field-editor="columns.0.elements.0.type"]').selectOption('button');
  await expect(panel.locator('[data-field-editor="columns.0.elements.0.text"]')).toHaveCount(0);
  await panel.locator('[data-field-editor="columns.0.elements.0.label"]').fill('Découvrir');
  await panel.locator('[data-field-editor="columns.0.elements.0.href"]').fill('/contact');
  await panel.locator('[data-field-editor="background"]').selectOption('image');
  await panel.locator('[data-field-editor="background_image"]').selectOption('/medias/background.webp');
  const result = await page.evaluate(() => {
    const component = window.sjdVisualEditor.getSelected();
    return { data: JSON.parse(component.getAttributes()['data-sjd-data']), styles: window.sjdVisualEditor.getProjectData().styles };
  });
  expect(result.data.background_image).toBe('/medias/background.webp');
  expect(result.data.columns.map((column) => Number(column.span)).reduce((sum, span) => sum + span, 0)).toBe(12);
  expect(result.data.columns[0].elements[0]).toMatchObject({ type: 'button', label: 'Découvrir', href: '/contact' });
  expect(result.styles).toEqual([]);
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
  expect([...kinds].sort()).toEqual(['bool', 'choice', 'color', 'ctas', 'html', 'html-line', 'image', 'images', 'items', 'lines', 'number', 'text', 'textarea'].sort());
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
  await expect(blocks).toHaveCount(20);
  await blocks.filter({ hasText: 'Chapitre éditorial' }).click();

  const preview = page.frameLocator('#visual-live-preview');
  const section = preview.locator('.sjd-block[data-block-type="chapter"] .s-chap');
  await expect(section).toBeVisible();
  await expect(section.locator('h2')).toHaveText('Titre de chapitre');
  await page.locator('#visual-section-panel [data-field-editor="dark"]').check();
  await expect.poll(() => page.evaluate(() => JSON.parse(window.sjdVisualEditor.getSelected().getAttributes()['data-sjd-data']).dark)).toBe(true);
  await expect(section).toHaveClass(/dark/);

  await page.locator('#visual-section-panel [data-field-editor="title"]').fill('Titre modifié');
  await expect(section.locator('h2')).toHaveText('Titre modifié');
  await page.locator('#visual-save').click();
  await expect(page.locator('#visual-status')).toHaveText('Brouillon enregistré');
  expect(calls).toHaveLength(1);
  const savedProject = calls[0].project;
  expect(savedProject.project_data.styles).toEqual([]);
  expect(JSON.stringify(savedProject)).toContain('Titre modifié');
  expect(JSON.stringify(savedProject)).toContain('sjd-section-chapter');
  await page.evaluate((project) => window.sjdVisualEditor.loadProjectData(project.project_data), savedProject);
  await expect(preview.locator('.sjd-block[data-block-type="chapter"] h2')).toHaveText('Titre modifié');
});

test('loads a versioned server project and makes its authored fields editable', async ({ page }) => {
  const fallbackCss = await readFile(new URL('../../../../theme/assets/site-noscript.css', import.meta.url), 'utf8');
  await page.route('**/src/demo-theme.css', (route) => route.fulfill({
    status: 200, contentType: 'text/css', body: '.reveal { opacity: 0; transform: translateY(52px); }',
  }));
  await page.route('**/assets/site-noscript.css', (route) => route.fulfill({
    status: 200, contentType: 'text/css', body: fallbackCss,
  }));
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
  const revealStyle = await canvas.locator('.s-chap').evaluate((node) => ({
    opacity: getComputedStyle(node).opacity,
    transform: getComputedStyle(node).transform,
  }));
  expect(revealStyle).toEqual({ opacity: '1', transform: 'none' });
  const editable = await page.evaluate(() => window.sjdVisualEditor.getWrapper().find('[data-sjd-field="title"]')[0].get('editable'));
  expect(editable).toBe(true);
});

test('renders existing dynamic Vaasam sections with their content in the canvas', async ({ page }) => {
  await page.route('**/assets/projects/project-vaasam.svg', (route) => route.fulfill({
    status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#ddd"/></svg>',
  }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const citationShell = () => [{ tagName: 'div', attributes: { class: 'container' }, components: [{
    tagName: 'blockquote', attributes: { class: 'quote' }, components: [
      { tagName: 'p', attributes: { class: 'quote-text', 'data-sjd-field': 'quote' }, content: '' },
      { tagName: 'footer', attributes: { class: 'quote-source' }, components: [
        { tagName: 'cite', attributes: { 'data-sjd-field': 'author' }, content: '' },
        { tagName: 'span', attributes: { class: 'quote-role', 'data-sjd-field': 'role' }, content: '' },
      ] },
    ],
  }] }];
  const dynamicSection = (name, data, variant = '') => ({
    type: `sjd-section-${name}`,
    tagName: 'section',
    attributes: {
      class: 'citation reveal legacy-theme-token',
      'data-sjd-section': name,
      'data-sjd-visible': '1',
      'data-sjd-variant': variant,
      'data-sjd-data': JSON.stringify(data),
    },
    components: citationShell(),
  });
  const project = {
    pages: [{ id: 'vaasam', frames: [{ id: 'frame', component: { type: 'wrapper', components: [
      dynamicSection('hero', {
        kicker: 'Projet — Identité de marque',
        title: 'Vaasam Paris.<br>Identité & direction artistique.',
        intro: 'Une identité complète pour une adresse parisienne.',
        cover: '/assets/projects/project-vaasam.svg',
        cover_alt: '',
        _variant: 'projet',
      }, 'projet'),
      dynamicSection('etude-de-cas', { blocks: [
        { kind: 'liste', title: 'Mission', items: ['Stratégie de marque', 'Logotype et déclinaisons'] },
        { kind: 'texte', title: 'Approche', body: '<p>Une marque fonctionnelle et lisible.</p>' },
      ] }),
      dynamicSection('cta-final', {
        kicker: 'La suite',
        title: 'Votre projet mérite la même exigence.',
        intro: 'Un premier échange pour comprendre votre activité.',
        ctas: [{ label: 'Parlons de votre projet', href: '/contact', style: 'pill--filled' }],
        _variant: 'interne',
      }, 'interne'),
      dynamicSection('galerie', {
        label: 'Visuels',
        images: [
          { src: '/assets/projects/project-vaasam.svg', alt: 'Logo Vaasam', caption: 'Logo principal' },
          { src: '/assets/projects/project-vaasam.svg', alt: 'Système graphique', caption: 'Système graphique' },
        ],
        columns: 3,
      }),
    ] } }] }], styles: [], assets: [],
  };
  await page.evaluate((data) => window.sjdLoadVisualProject(data), project);
  const canvas = page.frameLocator('iframe.gjs-frame');
  await expect(canvas.locator('[data-sjd-section="hero"]')).toHaveClass(/sjd-editor-section-hero/);
  await expect(canvas.locator('[data-sjd-section="hero"]')).toHaveClass(/legacy-theme-token/);
  await expect(canvas.locator('[data-sjd-section="hero"]')).toHaveClass(/citation/);
  await expect(canvas.locator('[data-sjd-section="hero"]')).toContainText('Vaasam Paris.');
  await expect(canvas.locator('[data-sjd-section="hero"]')).toContainText('Une identité complète pour une adresse parisienne.');
  await expect(canvas.locator('[data-sjd-section="hero"] img')).toHaveAttribute('src', '/assets/projects/project-vaasam.svg');
  await expect(canvas.locator('[data-sjd-section="etude-de-cas"]')).toContainText('Approche');
  await expect(canvas.locator('[data-sjd-section="etude-de-cas"]')).toContainText('Une marque fonctionnelle et lisible.');
  await expect(canvas.locator('[data-sjd-section="cta-final"]')).toContainText('Votre projet mérite la même exigence.');
  await expect(canvas.locator('[data-sjd-section="cta-final"]')).toContainText('Parlons de votre projet');
  await expect(canvas.locator('[data-sjd-section="galerie"] img')).toHaveCount(2);
  await expect(canvas.locator('[data-sjd-section="galerie"] img').nth(0)).toHaveAttribute('src', '/assets/projects/project-vaasam.svg');
  await expect(canvas.locator('[data-sjd-section="galerie"]')).toContainText('Logo principal');
  await expect(canvas.locator('[data-sjd-section="galerie"]')).toContainText('Système graphique');
  await page.evaluate(() => { window.sjdVisualEditor.select(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="hero"]')[0]); });
  await page.locator('[data-field-editor="title"]').fill('Vaasam révisé');
  await expect(canvas.locator('[data-sjd-section="hero"]')).toContainText('Vaasam révisé');
  const savedProject = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  const hero = savedProject.pages[0].frames[0].component.components.find((item) => item.attributes['data-sjd-section'] === 'hero');
  expect(hero.classes).toEqual(expect.arrayContaining(['citation', 'reveal', 'legacy-theme-token', 'sjd-editor-section', 'sjd-editor-section-hero']));
  await page.evaluate((data) => window.sjdLoadVisualProject(data), savedProject);
  await expect(canvas.locator('[data-sjd-section="hero"]')).toContainText('Vaasam révisé');
  await expect(canvas.locator('[data-sjd-section="hero"]')).toHaveClass(/legacy-theme-token/);
  await expect(canvas.locator('[data-sjd-section="galerie"] img')).toHaveCount(2);
  await expect(canvas.locator('[data-sjd-section="galerie"] img').nth(0)).toHaveAttribute('src', '/assets/projects/project-vaasam.svg');
  await expect(canvas.locator('[data-sjd-section="galerie"] img').nth(1)).toHaveAttribute('src', '/assets/projects/project-vaasam.svg');
  await page.evaluate(() => { window.sjdVisualEditor.select(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="etude-de-cas"]')[0]); });
  await page.locator('[data-field-editor="blocks.0.title"]').fill('Mission révisée');
  await expect(canvas.locator('[data-sjd-section="etude-de-cas"]')).toContainText('Mission révisée');
  await page.evaluate(() => { window.sjdVisualEditor.select(window.sjdVisualEditor.getWrapper().find('[data-sjd-section="cta-final"]')[0]); });
  await page.locator('[data-field-editor="title"]').fill('CTA révisé');
  await expect(canvas.locator('[data-sjd-section="cta-final"]')).toContainText('CTA révisé');
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
    await expect(page.locator('#visual-preview-stage')).toBeVisible();
    await expect(page.locator('#visual-live-preview')).toBeVisible();
    await expect(page.locator('#visual-traits')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(width);
    if (width <= 900) {
      const bounds = await page.evaluate(() => ({
        previewBottom: document.querySelector('#visual-preview-stage').getBoundingClientRect().bottom,
        traitsTop: document.querySelector('#visual-traits').getBoundingClientRect().top,
      }));
      expect(bounds.traitsTop).toBeGreaterThanOrEqual(bounds.previewBottom - 1);
    }
  }
});

test('settings_drawer_saves page metadata and retains edits after duplicate slug errors', async ({ page }) => {
  let payload;
  await page.route('**/api/admin/pages/1', async (route) => {
    if (route.request().method() === 'PATCH') {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { detail: 'Ce slug est déjà utilisé.' } }) });
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres de page' }).click();
  const drawer = page.getByRole('dialog', { name: 'Paramètres de page' });
  await drawer.getByRole('textbox', { name: 'Titre', exact: true }).fill('Une page éditée');
  await drawer.getByLabel('Slug').fill('deja-pris');
  await drawer.getByLabel('Métadonnées JSON').fill('{"custom":"Valeur"}');
  await drawer.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(drawer.getByRole('alert')).toContainText('déjà utilisé');
  await expect(drawer.getByRole('textbox', { name: 'Titre', exact: true })).toHaveValue('Une page éditée');
  expect(payload).toMatchObject({ title: 'Une page éditée', slug: 'deja-pris', meta: { custom: 'Valeur' } });
});

test('page_settings_media_selection_is_submitted_for_cover_and_social_image', async ({ page }) => {
  let payload;
  await page.route('**/api/editor/media', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ medias: [
    { id: 12, path: 'medias/cover.webp', alt: 'Couverture', mime: 'image/webp' },
    { id: 13, path: 'medias/og.webp', alt: 'Partage', mime: 'image/webp' },
  ] }) }));
  await page.route('**/api/admin/pages/1', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ page: { id: 1, ...payload } }) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Paramètres de page' }).click();
  const drawer = page.getByRole('dialog', { name: 'Paramètres de page' });
  await drawer.getByLabel('Image de couverture').selectOption('/medias/cover.webp');
  await drawer.getByLabel('Image Open Graph').selectOption('/medias/og.webp');
  await drawer.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  expect(payload).toMatchObject({ cover: '/medias/cover.webp', og_image: '/medias/og.webp' });
});

 test('keeps_page_settings_usable_when_the_media_api_fails', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/editor/media', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"indisponible"}' }));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  await page.getByRole('button', { name: 'Paramètres de page' }).click();
  await expect(page.getByRole('dialog', { name: 'Paramètres de page' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('restores_page_revisions after confirming discard of a divergent draft', async ({ page }) => {
  const restorePayloads = [];
  await page.route('**/api/admin/revisions?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ revisions: [{ id: 77, created_at: '2026-09-03T10:00:00Z', summary: 'Titre précédent' }] }),
  }));
  await page.route('**/api/admin/revisions/77/restaurer', async (route) => {
    const payload = route.request().postDataJSON();
    restorePayloads.push(payload);
    if (restorePayloads.length === 1) {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { detail: 'Brouillon divergent.' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ page: { id: 1, title: 'Restauré' } }) });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Historique des versions' }).click();
  await expect(page.getByText('Titre précédent')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurer la version Titre précédent' }).click();
  await expect.poll(() => restorePayloads.length).toBe(2);
  expect(restorePayloads).toEqual([
    { expected_visual_version: 0, confirm_discard_draft: false },
    { expected_visual_version: 0, confirm_discard_draft: true },
  ]);
});

test('adds_all_types_and_round_trips_a_single_visual_project', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.sjdVisualEditor && document.documentElement.dataset.visualEditorReady));
  const expectedTypes = await page.evaluate(() => window.sjdVisualEditor.BlockManager.getAll().models.map((block) => String(block.get('id')).replace(/^sjd-section-/, '')));
  await page.evaluate(() => window.sjdVisualEditor.getWrapper().set('components', []));
  for (const block of await page.locator('#visual-blocks .gjs-block').all()) await block.click();
  const components = await page.evaluate(() => window.sjdVisualEditor.getWrapper().get('components').models.map((model) => {
    const attributes = model.getAttributes();
    return { section: attributes['data-sjd-section'], data: attributes['data-sjd-data'] };
  }));
  expect(components).toHaveLength(20);
  expect(components.map((component) => component.section)).toEqual(expectedTypes);
  const faq = components.find((component) => component.section === 'faq');
  expect(faq).toBeTruthy();
  await page.evaluate(() => {
    const models = window.sjdVisualEditor.getWrapper().get('components').models;
    const faqComponent = models.find((model) => model.getAttributes()['data-sjd-section'] === 'faq');
    faqComponent.addAttributes({ 'data-sjd-data': JSON.stringify({ title: 'FAQ persistée', items: [{ q: 'Question imbriquée', a: 'Réponse conservée' }] }) });
  });
  await page.waitForTimeout(1050);
  const project = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  const lastSave = calls.at(-1);
  expect(lastSave.project.project_data.pages[0].frames[0].component.components).toHaveLength(20);
  await page.evaluate((value) => window.sjdLoadVisualProject(value), lastSave.project.project_data);
  const reloaded = await page.evaluate(() => window.sjdVisualEditor.getProjectData());
  const reloadedComponents = reloaded.pages[0].frames[0].component.components;
  expect(reloadedComponents.map((component) => component.attributes['data-sjd-section'])).toEqual(expectedTypes);
  const reloadedFaq = reloadedComponents.find((component) => component.attributes['data-sjd-section'] === 'faq');
  expect(JSON.parse(reloadedFaq.attributes['data-sjd-data'])).toEqual({ title: 'FAQ persistée', items: [{ q: 'Question imbriquée', a: 'Réponse conservée' }] });
  expect(project.pages[0].frames[0].component.components.map((component) => component.attributes['data-sjd-section'])).toEqual(expectedTypes);
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
