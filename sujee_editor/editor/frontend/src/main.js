import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './visual-editor.css';
import { registerSujeeTheme, prepareThemeProject } from './theme-plugin.js';
import { DEMO_BLOCKS } from './demo-schema.js';
import { mountSectionPanel } from './section-panel.js';
import { mountPageSettings } from './page-settings.js';
import { mountRevisionPanel } from './revision-panel.js';
import { mountMediaLibrary, mediaName, mediaUrl } from './media-library.js';

const config = JSON.parse(document.querySelector('#visual-config')?.textContent || '{}');
const blockSchema = config.blocks || DEMO_BLOCKS;
const status = document.querySelector('#visual-status');
const saveButton = document.querySelector('#visual-save');
const rebaseButton = document.querySelector('#visual-rebase');
const publishButton = document.querySelector('#visual-publish');
let draftVersion = Number(config.draft_version || 0);
let changed = false;
let ready = false;
let loadingProject = false;
let editRevision = 0;
let savePromise = null;
let savedProjectSnapshot = '';
let saveTimer;
let previewTimer;
let previewSequence = 0;
const livePreviewFrame = document.querySelector('#visual-live-preview');
const previewStatus = document.querySelector('#visual-preview-status');

function setStatus(message, kind = '') {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = kind;
}

function highlightPreviewSelection() {
  const doc = livePreviewFrame?.contentDocument;
  if (!doc) return;
  doc.querySelectorAll('.sjd-block.sjd-editor-selected').forEach((node) => node.classList.remove('sjd-editor-selected'));
  const selected = editor.getSelected();
  if (!selected) return;
  const position = editor.getWrapper().components().indexOf(selected);
  if (position >= 0) doc.querySelector(`.sjd-block[data-block-position="${position}"]`)?.classList.add('sjd-editor-selected');
}

function installPreviewInteractions() {
  const doc = livePreviewFrame?.contentDocument;
  if (!doc) return;
  const previewStyle = doc.createElement('style');
  previewStyle.textContent = `
    .reveal { opacity: 1 !important; transform: none !important; animation: none !important; }
    .sjd-block[data-block-position] { cursor: pointer; outline: 1px solid transparent; outline-offset: -1px; transition: outline-color .14s ease; }
    .sjd-block[data-block-position]:hover { outline: 1px dashed rgba(255, 74, 23, .75) !important; }
    .sjd-block.sjd-editor-selected { outline: 2px solid #ff4a17 !important; outline-offset: -2px; }
  `;
  doc.head?.append(previewStyle);
  doc.addEventListener('click', (event) => {
    const target = event.target;
    const link = target?.closest?.('a');
    if (link) event.preventDefault();
    const block = target?.closest?.('.sjd-block[data-block-position]');
    if (!block) return;
    event.preventDefault();
    event.stopPropagation();
    const position = Number(block.dataset.blockPosition);
    const component = editor.getWrapper().components().at(position);
    if (component) editor.select(component);
  }, true);
  highlightPreviewSelection();
  // Sélection par défaut : on ouvre l'éditeur avec la première section active,
  // sinon le panneau « Options de section » reste vide et on ne sait pas où cliquer.
  if (!editor.getSelected()) {
    const first = editor.getWrapper().components().at(0);
    if (first) editor.select(first);
  }
}

async function refreshLivePreview() {
  if (!livePreviewFrame || !config.preview_api || !ready || loadingProject) return;
  const sequence = ++previewSequence;
  const projectData = editor.getProjectData();
  const scroll = {
    x: livePreviewFrame.contentWindow?.scrollX || 0,
    y: livePreviewFrame.contentWindow?.scrollY || 0,
  };
  if (previewStatus) previewStatus.textContent = 'Rendu du thème…';
  try {
    const response = await fetch(config.preview_api, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-SJD-CSRF': config.csrf },
      body: JSON.stringify({
        project: {
          schema_version: config.project?.schema_version,
          theme_id: config.project?.theme_id,
          theme_version: config.project?.theme_version,
          project_data: projectData,
        },
      }),
    });
    if (!response.ok) throw new Error(`Aperçu indisponible (${response.status})`);
    const rendered = await response.text();
    if (sequence !== previewSequence) return;
    livePreviewFrame.onload = () => {
      if (sequence !== previewSequence) return;
      installPreviewInteractions();
      livePreviewFrame.contentWindow?.scrollTo(scroll.x, scroll.y);
      if (previewStatus) previewStatus.textContent = 'Aperçu fidèle au site';
    };
    livePreviewFrame.srcdoc = rendered;
  } catch (error) {
    if (sequence === previewSequence && previewStatus) previewStatus.textContent = error.message || 'Aperçu indisponible';
  }
}

function scheduleLivePreview() {
  if (!config.preview_api || !livePreviewFrame) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { void refreshLivePreview(); }, 250);
}

export const editor = grapesjs.init({
  container: '#visual-canvas', height: '100%', fromElement: false, storageManager: false,
  panels: { defaults: [] }, blockManager: { appendTo: '#visual-blocks' },
  traitManager: { appendTo: '#visual-traits' }, styleManager: { sectors: [] },
  selectorManager: { componentFirst: true },
  canvas: { styles: config.theme_styles || ['/assets/site.css'] },
  plugins: [(instance) => registerSujeeTheme(instance, blockSchema)],
});
window.sjdVisualEditor = editor;
window.sjdLoadVisualProject = (projectData) => {
  loadingProject = true;
  try {
    editor.loadProjectData(projectData);
    prepareThemeProject(editor, blockSchema);
    savedProjectSnapshot = JSON.stringify(editor.getProjectData());
    changed = false;
    clearTimeout(saveTimer);
  } finally {
    loadingProject = false;
  }
  if (ready) scheduleLivePreview();
};
if (config.project?.project_data) window.sjdLoadVisualProject(config.project.project_data);

async function request(path, method, payload) {
  const response = await fetch(`${config.api}/pages/${config.page.id}/visual-project${path}`, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-SJD-CSRF': config.csrf },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.detail || data.detail || `Erreur ${response.status}`;
    const error = new Error(message);
    error.rule = data.error?.rule || '';
    if (response.status === 409 && error.rule !== 'source_changed') {
      error.message = `${message}. Recharge la page pour récupérer la dernière version.`;
    }
    throw error;
  }
  return data;
}

const mediaLibrary = mountMediaLibrary({ endpoint: `${config.api}/media`, csrf: config.csrf });
const mediaClient = {
  populate(select, currentPath, onSelect) {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'visual-media-picker-trigger';
    trigger.dataset.mediaPickerTrigger = '';
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Choisir une image');
    select.hidden = true;
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    const update = (path, item = null) => {
      const value = String(path || '');
      select.replaceChildren();
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.append(option);
      select.value = value;
      trigger.textContent = item ? `Changer l’image · ${mediaName(item)}` : value ? 'Changer l’image' : 'Choisir une image…';
      trigger.title = item ? mediaName(item) : value;
    };

    update(currentPath);
    if (select.parentNode) select.after(trigger);
    trigger.addEventListener('click', async () => {
      trigger.disabled = true;
      try {
        const item = await mediaLibrary.open(select.value);
        if (!item) return;
        const path = mediaUrl(item);
        if (!path) return;
        update(path, item);
        onSelect?.(path, item);
      } catch (error) {
        setStatus(error.message || 'Impossible d’ouvrir la médiathèque', 'error');
      } finally {
        trigger.disabled = false;
      }
    });
    return { trigger, update: (path) => update(path) };
  },
};

const mediaPanel = document.createElement('section');
mediaPanel.className = 'visual-media-panel';
mediaPanel.hidden = true;
const mediaLabel = document.createElement('label');
mediaLabel.htmlFor = 'visual-media-picker';
mediaLabel.textContent = 'Médiathèque';
const mediaPicker = document.createElement('select');
mediaPicker.id = 'visual-media-picker';
mediaPicker.setAttribute('aria-label', 'Choisir une image dans la médiathèque');
const mediaLink = document.createElement('a');
mediaLink.href = '/admin/medias';
mediaLink.target = '_blank';
mediaLink.rel = 'noopener';
mediaLink.textContent = 'Gérer les images';
mediaPanel.append(mediaLabel, mediaPicker, mediaLink);
document.querySelector('#visual-traits')?.append(mediaPanel);
const mediaPickerBinding = mediaClient.populate(mediaPicker, '', (src, media) => {
  const selected = editor.getSelected();
  if (!selected || !media) return;
  selected.set('src', src);
  selected.addAttributes({ src, alt: String(media.alt || '') });
  changed = true;
  editRevision += 1;
  setStatus('Image modifiée, brouillon non enregistré', 'pending');
});

const sectionPanelRoot = document.createElement('section');
sectionPanelRoot.id = 'visual-section-panel';
sectionPanelRoot.className = 'visual-section-panel';
sectionPanelRoot.hidden = true;
document.querySelector('#visual-traits')?.append(sectionPanelRoot);
const sectionPanel = mountSectionPanel({ root: sectionPanelRoot, editor, blockSchema, mediaClient });
window.sjdSectionPanel = sectionPanel;
const pageUiRoot = document.createElement('div');
pageUiRoot.className = 'visual-page-tools';
document.querySelector('.visual-actions')?.prepend(pageUiRoot);
const pageSettings = mountPageSettings({ root: pageUiRoot, page: config.page || {}, mediaClient });
const revisionPanel = mountRevisionPanel({ root: pageUiRoot, pageId: config.page?.id, getDraftVersion: () => draftVersion });
window.sjdPageSettings = pageSettings;
window.sjdRevisionPanel = revisionPanel;

editor.on('component:selected', (component) => {
  highlightPreviewSelection();
  const isImage = component?.get('type') === 'image'
    || component?.getAttributes?.()['data-sjd-field'] === 'src';
  mediaPanel.hidden = !isImage;
  if (!isImage) return;
  mediaPickerBinding.update(component.getAttributes().src || '');
});

async function saveDraft() {
  if (savePromise) return savePromise;
  clearTimeout(saveTimer);
  if (saveButton) saveButton.disabled = true;
  const operation = (async () => {
    setStatus('Enregistrement…');
    try {
      while (true) {
        const revisionAtStart = editRevision;
        const projectData = editor.getProjectData();
        const projectSnapshot = JSON.stringify(projectData);
        const project = {
          schema_version: config.project?.schema_version,
          theme_id: config.project?.theme_id,
          theme_version: config.project?.theme_version,
          project_data: projectData,
        };
        const result = await request('', 'PUT', { expected_version: draftVersion, project });
        draftVersion = result.draft_version;
        savedProjectSnapshot = projectSnapshot;
        if (editRevision !== revisionAtStart || JSON.stringify(editor.getProjectData()) !== projectSnapshot) {
          changed = true;
          setStatus('Enregistrement des dernières modifications…', 'pending');
          continue;
        }
        changed = false;
        setStatus('Brouillon enregistré', 'success');
        return true;
      }
    } catch (error) {
      setStatus(error.message || 'Échec de l’enregistrement', 'error');
      return false;
    }
  })();
  savePromise = operation;
  try {
    return await operation;
  } finally {
    if (savePromise === operation) savePromise = null;
    clearTimeout(saveTimer);
    if (saveButton) saveButton.disabled = false;
  }
}

saveButton?.addEventListener('click', () => { void saveDraft(); });

// Ctrl/Cmd+S : enregistrer sans quitter le clavier (évite le "Enregistrer la page" du navigateur).
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (!event.repeat) void saveDraft();
  }
});

rebaseButton?.addEventListener('click', async () => {
  if (!window.confirm('Le brouillon visuel sera remplacé par le contenu courant de la page. Continuer ?')) return;
  rebaseButton.disabled = true;
  try {
    const result = await request('/rebase', 'POST', { expected_version: draftVersion });
    draftVersion = result.draft_version;
    if (result.project?.project_data) window.sjdLoadVisualProject(result.project.project_data);
    changed = false;
    clearTimeout(saveTimer);
    setStatus('Contenu rechargé. Vérifie-le, puis enregistre ou publie.', 'success');
    rebaseButton.hidden = true;
  } catch (error) {
    setStatus(error.message || 'Impossible de recharger le contenu', 'error');
  } finally {
    rebaseButton.disabled = false;
  }
});

publishButton?.addEventListener('click', async () => {
  if (!window.confirm('Publier ces changements sur le site ?')) return;
  publishButton.disabled = true;
  try {
    if (changed && !(await saveDraft())) return;
    setStatus('Publication…');
    const result = await request('/publish', 'POST', { expected_version: draftVersion });
    draftVersion = result.draft_version;
    changed = false;
    if (result.project?.project_data) window.sjdLoadVisualProject(result.project.project_data);
    setStatus('Page publiée', 'success');
  } catch (error) {
    if (error.rule === 'source_changed' && rebaseButton) rebaseButton.hidden = false;
    setStatus(error.rule === 'source_changed'
      ? `${error.message}. Le bouton de rechargement remplacera ce brouillon visuel.`
      : error.message || 'Échec de la publication', 'error');
  } finally {
    publishButton.disabled = false;
  }
});

editor.on('load', () => {
  ready = true;
  document.documentElement.dataset.visualEditorReady = '1';
  scheduleLivePreview();
});
editor.on('update', () => {
  if (!ready || loadingProject) return;
  if (JSON.stringify(editor.getProjectData()) === savedProjectSnapshot) return;
  editRevision += 1;
  changed = true;
  setStatus('Modifications non enregistrées', 'pending');
  scheduleLivePreview();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveDraft(); }, 900);
});
window.addEventListener('beforeunload', (event) => {
  if (changed) { event.preventDefault(); event.returnValue = ''; }
});
