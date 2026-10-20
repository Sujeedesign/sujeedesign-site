export function mountRevisionPanel({ root, pageId, getDraftVersion, api = '/api/admin/revisions' }) {
  const launcher = document.createElement('button');
  launcher.type = 'button'; launcher.textContent = 'Historique des versions'; launcher.setAttribute('aria-label', launcher.textContent);
  const panel = document.createElement('section'); panel.className = 'revision-panel';
  panel.setAttribute('aria-label', 'Historique des versions'); panel.hidden = true;
  const heading = document.createElement('h2'); heading.textContent = 'Historique des versions';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Fermer'; close.setAttribute('aria-label', 'Fermer l’historique');
  close.addEventListener('click', () => { panel.hidden = true; launcher.focus(); });
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  const list = document.createElement('ol');
  panel.append(heading, close, message, list); root.append(launcher, panel);
  let revisions = [];
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error?.detail || data.detail || `Erreur ${response.status}`); error.status = response.status; throw error; }
    return data;
  }
  async function refresh() {
    message.textContent = 'Chargement…';
    try {
      const data = await request(`${api}?entity_type=page&entity_id=${encodeURIComponent(pageId)}`);
      revisions = Array.isArray(data.revisions) ? data.revisions : [];
      list.replaceChildren();
      if (!revisions.length) message.textContent = 'Aucune version enregistrée.';
      else {
        message.textContent = '';
        for (const revision of revisions) {
          const item = document.createElement('li');
          const summary = String(revision.summary || revision.note || revision.title || `Version ${revision.id}`);
          const text = document.createElement('span'); text.textContent = summary;
          const date = document.createElement('time'); date.textContent = revision.created_at || '';
          const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Restaurer';
          restore.setAttribute('aria-label', `Restaurer la version ${summary}`);
          restore.addEventListener('click', () => void restoreRevision(revision.id));
          item.append(text, date, restore); list.append(item);
        }
      }
    } catch (error) { message.textContent = error.message || 'Impossible de charger l’historique'; }
  }
  async function restoreRevision(id, confirmed = false) {
    message.textContent = 'Restauration…';
    try {
      await request(`${api}/${encodeURIComponent(id)}/restaurer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SJD-CSRF': JSON.parse(document.querySelector('#visual-config')?.textContent || '{}').csrf },
        body: JSON.stringify({ expected_visual_version: getDraftVersion(), confirm_discard_draft: confirmed }),
      });
      window.location.reload();
    } catch (error) {
      if (error.status === 409 && !confirmed) {
        if (window.confirm('Cette page a un brouillon visuel différent. Restaurer cette version supprimera ce brouillon. Continuer ?')) return restoreRevision(id, true);
        message.textContent = 'Restauration annulée.';
      } else message.textContent = error.message || 'Impossible de restaurer cette version';
    }
  }
  launcher.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) void refresh(); });
  return { refresh, destroy() { launcher.remove(); panel.remove(); } };
}
