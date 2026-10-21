function normalizePath(path) {
  const relative = String(path || '').replace(/^\/+/, '');
  if (!/^[a-z0-9._/-]+$/i.test(relative)) return '';
  if (!(relative.startsWith('medias/') || relative.startsWith('assets/'))) return '';
  if (relative.split('/').some((part) => !part || part === '.' || part === '..')) return '';
  return `/${relative}`;
}

export function mediaUrl(media) {
  return normalizePath(media?.path);
}

export function mediaName(media) {
  return String(media?.original_filename || media?.filename || `Image ${media?.id || ''}`).trim();
}

function isImage(media) {
  return media?.mime?.startsWith('image/')
    || /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(String(media?.path || media?.filename || ''));
}

function make(tag, attributes = {}, text = '') {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  if (text) node.textContent = text;
  return node;
}

export function mountMediaLibrary({ endpoint, csrf, root = document.body }) {
  const dialog = make('dialog', { class: 'visual-media-dialog', 'aria-labelledby': 'visual-media-title' });
  const header = make('header', { class: 'visual-media-header' });
  const heading = make('h2', { id: 'visual-media-title' }, 'Médiathèque d’images');
  const close = make('button', { type: 'button', class: 'visual-media-close', 'aria-label': 'Fermer la médiathèque' }, '×');
  header.append(heading, close);

  const intro = make('p', { class: 'visual-media-intro' }, 'Choisis une miniature ou ajoute une nouvelle image.');
  const search = make('input', {
    class: 'visual-media-search', type: 'search', placeholder: 'Rechercher une image…',
    'aria-label': 'Rechercher une image',
  });
  const uploadForm = make('form', { class: 'visual-media-upload' });
  const fileLabel = make('label', { for: 'media-picker-upload-file' }, 'Ajouter une image');
  const fileInput = make('input', { id: 'media-picker-upload-file', type: 'file', accept: 'image/*', 'aria-label': 'Image à téléverser' });
  const uploadButton = make('button', { type: 'submit', class: 'visual-media-upload-button' }, 'Importer dans la médiathèque');
  uploadForm.append(fileLabel, fileInput, uploadButton);
  const status = make('p', { id: 'media-picker-status', class: 'visual-media-status', role: 'status', 'aria-live': 'polite' });
  const grid = make('div', { class: 'visual-media-grid', 'aria-label': 'Images disponibles' });
  dialog.append(header, intro, search, uploadForm, status, grid);
  root.append(dialog);

  let items = [];
  let loaded = false;
  let activeResolve = null;
  let currentPath = '';

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.dataset.state = kind;
  }

  function render() {
    grid.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase('fr');
    const visible = items.filter((item) => {
      const name = mediaName(item).toLocaleLowerCase('fr');
      const alt = String(item.alt || '').toLocaleLowerCase('fr');
      return !query || name.includes(query) || alt.includes(query);
    });
    for (const item of visible) {
      const url = mediaUrl(item);
      if (!url) continue;
      const name = mediaName(item);
      const card = make('button', {
        type: 'button', class: 'visual-media-card',
        'aria-label': `Sélectionner ${name}`,
        'aria-pressed': url === currentPath,
        'data-media-picker-item': item.id,
      });
      const image = make('img', { src: url, alt: String(item.alt || ''), loading: 'lazy' });
      const caption = make('span', { class: 'visual-media-card-name' }, name);
      card.append(image, caption);
      card.addEventListener('click', () => finish(item));
      grid.append(card);
    }
    if (!visible.length || !grid.childElementCount) {
      const empty = query ? 'Aucun résultat pour cette recherche.' : 'Aucune image disponible pour le moment.';
      grid.append(make('p', { class: 'visual-media-empty' }, empty));
    }
  }

  async function load() {
    if (loaded) return;
    const response = await fetch(endpoint, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || data.error?.message || `Médiathèque indisponible (${response.status})`);
    const refreshed = (Array.isArray(data.medias) ? data.medias : []).filter((item) => isImage(item) && mediaUrl(item));
    const refreshedIds = new Set(refreshed.map((item) => item.id));
    items = [...items.filter((item) => !refreshedIds.has(item.id)), ...refreshed];
    loaded = true;
  }

  function finish(item = null) {
    const resolve = activeResolve;
    activeResolve = null;
    if (dialog.open) dialog.close();
    resolve?.(item);
  }

  function open(path = '') {
    if (dialog.open) return Promise.resolve(null);
    currentPath = normalizePath(path);
    search.value = '';
    grid.replaceChildren();
    setStatus('Chargement de la médiathèque…');
    return new Promise((resolve, reject) => {
      activeResolve = resolve;
      try {
        dialog.showModal();
        close.focus();
      } catch (error) {
        activeResolve = null;
        reject(error);
        return;
      }
      void load().then(() => {
        setStatus(items.length ? 'Clique sur une miniature pour la sélectionner.' : 'Tu peux importer une image ci-dessus.');
        render();
      }).catch((error) => {
        setStatus(error.message || 'Impossible de charger la médiathèque.', 'error');
        render();
      });
    });
  }

  async function upload(event) {
    event.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus('Choisis d’abord une image à téléverser.', 'error');
      fileInput.focus();
      return;
    }
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'].includes(extension)) {
      setStatus('Format non pris en charge. Utilise JPG, PNG, WEBP, AVIF, GIF ou SVG.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStatus('Le fichier dépasse la limite de 8 Mo.', 'error');
      return;
    }
    const body = new FormData();
    body.append('file', file, file.name);
    const headers = {};
    if (csrf) headers['X-SJD-CSRF'] = csrf;
    uploadButton.disabled = true;
    fileInput.disabled = true;
    setStatus('Téléversement…');
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers, body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error?.message || `Téléversement refusé (${response.status})`);
      const media = data.media;
      if (!media || !mediaUrl(media)) throw new Error('La réponse du serveur ne contient pas une image valide.');
      items = [media, ...items.filter((item) => item.id !== media.id)];
      search.value = '';
      fileInput.value = '';
      setStatus('Image ajoutée. Clique sur sa miniature pour la sélectionner.');
      render();
    } catch (error) {
      setStatus(error.message || 'Échec du téléversement.', 'error');
    } finally {
      uploadButton.disabled = false;
      fileInput.disabled = false;
    }
  }

  close.addEventListener('click', () => finish(null));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(null); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) finish(null); });
  search.addEventListener('input', render);
  uploadForm.addEventListener('submit', (event) => { void upload(event); });

  return { open, close: () => finish(null) };
}
