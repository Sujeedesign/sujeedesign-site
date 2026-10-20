import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import './visual-editor.css';
import { registerSujeeTheme, prepareThemeProject } from './theme-plugin.js';
import { DEMO_BLOCKS } from './demo-schema.js';
import { mountSectionPanel } from './section-panel.js';
import { mountPageSettings } from './page-settings.js';
import { mountRevisionPanel } from './revision-panel.js';

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

function setStatus(message, kind = '') {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = kind;
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

const mediaPanel = document.createElement('section');
mediaPanel.className = 'visual-media-panel';
mediaPanel.hidden = true;
const mediaLabel = document.createElement('label');
mediaLabel.htmlFor = 'visual-media-picker';
mediaLabel.textContent = 'Médiathèque';
const mediaPicker = document.createElement('select');
mediaPicker.id = 'visual-media-picker';
mediaPicker.setAttribute('aria-label', 'Choisir une image dans la médiathèque');
mediaPicker.disabled = true;
const emptyOption = document.createElement('option');
emptyOption.value = '';
emptyOption.textContent = 'Chargement des images…';
mediaPicker.append(emptyOption);
const mediaLink = document.createElement('a');
mediaLink.href = '/admin/medias';
mediaLink.target = '_blank';
mediaLink.rel = 'noopener';
mediaLink.textContent = 'Gérer les images';
mediaPanel.append(mediaLabel, mediaPicker, mediaLink);
document.querySelector('#visual-traits')?.append(mediaPanel);
let mediaItems = [];
let mediaLoaded = false;

function normaliseMediaPath(path) {
  let value = String(path || '');
  while (value.startsWith('/')) value = value.slice(1);
  return value;
}

async function loadMediaLibrary() {
  if (mediaLoaded) return;
  const response = await fetch(`${config.api}/media`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Médiathèque indisponible (${response.status})`);
  const data = await response.json();
  mediaItems = (Array.isArray(data.medias) ? data.medias : []).filter((item) => {
    const relative = normaliseMediaPath(item.path);
    return item.mime?.startsWith('image/')
      && (relative.startsWith('medias/') || relative.startsWith('assets/'))
      && !relative.split('/').some((part) => part === '.' || part === '..');
  });
  mediaPicker.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = mediaItems.length ? 'Choisir une image…' : 'Aucune image disponible';
  mediaPicker.append(placeholder);
  for (const item of mediaItems) {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = item.alt || item.filename || `Image ${item.id}`;
    mediaPicker.append(option);
  }
  mediaPicker.disabled = mediaItems.length === 0;
  mediaLoaded = true;
}

const mediaClient = {
  async populate(select, currentPath, onSelect) {
    try {
      await loadMediaLibrary();
    } catch {
      select.replaceChildren();
      const current = String(currentPath || '');
      const option = document.createElement('option');
      option.value = current;
      option.textContent = current ? `Média actuel (${current}) · médiathèque indisponible` : 'Médiathèque indisponible';
      select.append(option);
      select.value = current;
      select.disabled = !current;
      return;
    }
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = mediaItems.length ? 'Choisir une image…' : 'Aucune image disponible';
    select.append(placeholder);
    for (const item of mediaItems) {
      const option = document.createElement('option');
      option.value = `/${normaliseMediaPath(item.path)}`;
      option.textContent = item.alt || item.filename || `Image ${item.id}`;
      select.append(option);
    }
    const current = String(currentPath || '');
    if (current && !mediaItems.some((item) => `/${normaliseMediaPath(item.path)}` === current)) {
      const preserved = document.createElement('option');
      preserved.value = current; preserved.textContent = `Média actuelle (${current})`;
      select.append(preserved);
    }
    select.value = current;
    select.addEventListener('change', () => onSelect(select.value));
  },
};

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

mediaPicker.addEventListener('change', () => {
  const selected = editor.getSelected();
  const media = mediaItems.find((item) => String(item.id) === mediaPicker.value);
  if (!selected || !media) return;
  const relative = normaliseMediaPath(media.path);
  const src = `/${relative}`;
  selected.set('src', src);
  selected.addAttributes({ src, alt: String(media.alt || '') });
  changed = true;
  editRevision += 1;
  setStatus('Image modifiée, brouillon non enregistré', 'pending');
});

editor.on('component:selected', async (component) => {
  const isImage = component?.get('type') === 'image'
    || component?.getAttributes?.()['data-sjd-field'] === 'src';
  mediaPanel.hidden = !isImage;
  if (!isImage) return;
  try {
    await loadMediaLibrary();
    const currentSrc = component.getAttributes().src || '';
    const current = mediaItems.find((item) => `/${normaliseMediaPath(item.path)}` === currentSrc);
    mediaPicker.value = current ? String(current.id) : '';
  } catch (error) {
    mediaPicker.replaceChildren();
    const option = document.createElement('option');
    option.value = '';
    option.textContent = error.message || 'Médiathèque indisponible';
    mediaPicker.append(option);
    mediaPicker.disabled = true;
  }
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
});
editor.on('update', () => {
  if (!ready || loadingProject) return;
  if (JSON.stringify(editor.getProjectData()) === savedProjectSnapshot) return;
  editRevision += 1;
  changed = true;
  setStatus('Modifications non enregistrées', 'pending');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void saveDraft(); }, 900);
});
window.addEventListener('beforeunload', (event) => {
  if (changed) { event.preventDefault(); event.returnValue = ''; }
});
