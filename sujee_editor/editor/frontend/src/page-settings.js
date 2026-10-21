const FIELDS = [
  ['title', 'Titre', 'text'], ['slug', 'Slug', 'text'],
  ['kind', 'Type', 'choice', ['accueil', 'page', 'service', 'realisation']],
  ['excerpt', 'Résumé', 'textarea'], ['cover', 'Image de couverture', 'media'],
  ['cover_alt', 'Texte alternatif de couverture', 'text'], ['client', 'Client', 'text'],
  ['year', 'Année', 'number'], ['num', 'Numéro', 'number'], ['position', 'Position', 'number'],
  ['categories', 'Catégories', 'text'], ['external_url', 'URL externe', 'url'],
  ['in_menu', 'Afficher dans le menu', 'checkbox'], ['menu_label', 'Libellé du menu', 'text'],
  ['menu_position', 'Position dans le menu', 'number'], ['seo_title', 'Titre SEO', 'text'],
  ['seo_description', 'Description SEO', 'textarea'], ['og_image', 'Image Open Graph', 'media'],
  ['robots', 'Robots', 'choice', ['index,follow', 'noindex,nofollow']],
  ['meta', 'Métadonnées JSON', 'json'],
];

export async function savePage(pageId, patch, csrf) {
  const response = await fetch(`/api/admin/pages/${encodeURIComponent(pageId)}`, {
    method: 'PATCH', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-SJD-CSRF': csrf },
    body: JSON.stringify(patch),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.detail || data.detail || `Erreur ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data.page || data;
}

export function mountPageSettings({ root, page, savePage: persist = savePage, mediaClient }) {
  const launcher = document.createElement('button');
  launcher.type = 'button'; launcher.textContent = 'Paramètres de page'; launcher.setAttribute('aria-label', launcher.textContent);
  const dialog = document.createElement('section');
  dialog.className = 'page-settings-drawer'; dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-label', 'Paramètres de page'); dialog.setAttribute('aria-modal', 'true'); dialog.hidden = true;
  const heading = document.createElement('h2'); heading.textContent = 'Paramètres de page';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Fermer';
  const form = document.createElement('form');
  const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.hidden = true;
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Enregistrer les paramètres';
  form.append(error);
  const controls = new Map();
  for (const [key, labelText, type, choices] of FIELDS) {
    const label = document.createElement('label'); label.textContent = labelText;
    let input;
    if (type === 'textarea' || type === 'json') input = document.createElement('textarea');
    else if (type === 'choice') {
      input = document.createElement('select');
      for (const choice of choices) { const option = document.createElement('option'); option.value = choice; option.textContent = choice; input.append(option); }
    } else if (type === 'media') { input = document.createElement('select'); input.dataset.media = 'true'; }
    else { input = document.createElement('input'); input.type = type; }
    input.name = key; input.setAttribute('aria-label', labelText);
    if (type === 'checkbox') input.checked = Boolean(page[key]);
    else if (type === 'json') input.value = JSON.stringify(page[key] || {}, null, 2);
    else input.value = Array.isArray(page[key]) ? page[key].join(', ') : (page[key] ?? '');
    label.append(input); form.append(label); controls.set(key, input);
    if (type === 'media' && mediaClient?.populate) void mediaClient.populate(input, page[key] || '', () => {});
  }
  form.append(save); dialog.append(heading, close, form); root.append(launcher, dialog);
  const open = () => { dialog.hidden = false; controls.get('title')?.focus(); };
  const shut = () => { dialog.hidden = true; };
  launcher.addEventListener('click', open); close.addEventListener('click', shut);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); error.hidden = true; save.disabled = true;
    const patch = {};
    for (const [key, input] of controls) {
      if (input.type === 'checkbox') patch[key] = input.checked;
      else if (input.type === 'number') patch[key] = input.value === '' ? null : Number(input.value);
      else if (key === 'categories') patch[key] = input.value.split(',').map((value) => value.trim()).filter(Boolean);
      else if (key === 'meta') {
        try { patch.meta = JSON.parse(input.value || '{}'); }
        catch { error.textContent = 'Les métadonnées doivent être un objet JSON valide.'; error.hidden = false; save.disabled = false; return; }
      } else patch[key] = input.value;
    }
    try { Object.assign(page, await persist(page.id, patch, JSON.parse(document.querySelector('#visual-config')?.textContent || '{}').csrf)); shut(); }
    catch (exception) { error.textContent = exception.message || 'Impossible d’enregistrer les paramètres'; error.hidden = false; }
    finally { save.disabled = false; }
  });
  return { open, close: shut, destroy() { launcher.remove(); dialog.remove(); } };
}
