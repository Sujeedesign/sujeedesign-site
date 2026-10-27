function clone(value) {
  return value == null ? value : structuredClone(value);
}

const BACKGROUND_LABELS = {
  default: 'Par défaut', none: 'Par défaut', paper: 'Clair', obsidian: 'Sombre',
  accent: 'Accent bronze', gradient: 'Dégradé animé', 'hero-gradient': 'Fond animé du hero d’accueil', custom: 'Couleur personnalisée', image: 'Image de fond',
};

function fieldDefault(field) {
  if (Object.hasOwn(field, 'default')) return clone(field.default);
  if (field.kind === 'bool') return false;
  if (field.kind === 'number') return 0;
  if (field.kind === 'choice') return field.choices?.[0] || '';
  if (['lines', 'items', 'images', 'ctas'].includes(field.kind)) return [];
  return '';
}

function getAtPath(data, path) {
  return path.split('.').reduce((value, key) => value?.[/^\d+$/.test(key) ? Number(key) : key], data);
}

function setAtPath(data, path, value) {
  const parts = path.split('.');
  const key = parts.pop();
  const parent = parts.reduce((current, part) => current[/^\d+$/.test(part) ? Number(part) : part], data);
  parent[/^\d+$/.test(key) ? Number(key) : key] = value;
}

function rebalanceColumns(columns, changedIndex = null) {
  if (!Array.isArray(columns) || columns.length === 0) return;
  const count = columns.length;
  if (count === 1) {
    columns[0].span = '12';
    return;
  }
  const spans = columns.map((column) => Number(column?.span));
  const valid = spans.every((span) => Number.isInteger(span) && span >= 2) && spans.reduce((sum, span) => sum + span, 0) === 12;
  if (changedIndex == null && valid) return;

  if (Number.isInteger(changedIndex) && columns[changedIndex]) {
    const max = 12 - 2 * (count - 1);
    const proposed = Number(columns[changedIndex].span);
    const selected = Math.max(2, Math.min(max, Number.isFinite(proposed) ? proposed : Math.floor(12 / count)));
    columns[changedIndex].span = String(selected);
    const others = columns.map((_, index) => index).filter((index) => index !== changedIndex);
    let remaining = 12 - selected;
    const base = Math.floor(remaining / others.length);
    let extra = remaining % others.length;
    for (const index of others) {
      columns[index].span = String(base + (extra > 0 ? 1 : 0));
      extra -= 1;
    }
    return;
  }

  const base = Math.floor(12 / count);
  let extra = 12 % count;
  for (const [index, column] of columns.entries()) {
    column.span = String(base + (extra > 0 ? 1 : 0));
    extra -= 1;
  }
}

function readData(component, schema) {
  try {
    const parsed = JSON.parse(component.getAttributes()['data-sjd-data'] || '{}');
    return { ...Object.fromEntries(schema.fields.map((field) => [field.name, fieldDefault(field)])), ...parsed };
  } catch {
    return Object.fromEntries(schema.fields.map((field) => [field.name, fieldDefault(field)]));
  }
}

function element(tag, attrs = {}, text = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

export function mountSectionPanel({ root, editor, blockSchema, mediaClient }) {
  const panel = root || document.querySelector('#visual-section-panel');
  if (!panel) return { refresh() {}, destroy() {} };
  let selected = null;
  let schema = null;
  // Blocs de champs ouverts, conservés entre deux rafraîchissements du panneau.
  const openGroups = new Set(['contenu']);

  function commit(path, value) {
    if (!selected || !schema) return;
    const next = readData(selected, schema);
    setAtPath(next, path, value);
    if (schema.name === 'zone-libre') {
      const parts = path.split('.');
      if (path === 'columns') rebalanceColumns(next.columns);
      else if (parts[0] === 'columns' && parts.length === 3 && parts[2] === 'span' && Number.isInteger(Number(parts[1]))) {
        rebalanceColumns(next.columns, Number(parts[1]));
      }
    }
    const attributes = {
      'data-sjd-data': JSON.stringify(next),
      'data-sjd-variant': String(next._variant || ''),
    };
    if (schema.name === 'chapter' && typeof next.dark === 'boolean') {
      attributes['data-sjd-dark'] = next.dark ? '1' : '0';
    }
    selected.addAttributes(attributes);
    const plainField = selected.find(`[data-sjd-field="${CSS.escape(path)}"]`)[0];
    if (plainField && ['text', 'text/html'].includes(plainField.get('type'))) {
      plainField.set('content', String(value ?? ''));
    }
    panel.dataset.changed = 'true';
  }

  function addControl(field, path, value) {
    const group = element('div', { class: `section-field section-field-${field.kind}`, 'data-field-kind': field.kind });
    const id = `section-field-${path.replaceAll('.', '-')}`;
    const label = element('label', { for: id }, field.label || field.name);
    group.append(label);
    if (['items', 'images', 'ctas'].includes(field.kind)) {
      const list = Array.isArray(value) ? value : [];
      const rows = element('div', { class: 'section-repeat-list', 'data-repeat-path': path });
      list.forEach((itemValue, index) => {
        const card = element('fieldset', { class: 'section-repeat-item' });
        const legend = element('legend', {}, `${field.label || field.name} ${index + 1}`);
        card.append(legend);
        const elementFields = schema?.name === 'zone-libre' && field.name === 'elements'
          ? new Set(({ heading: ['type', 'text', 'level'], text: ['type', 'text'], button: ['type', 'label', 'href', 'role'], image: ['type', 'src', 'alt'], 'image-stack': ['type', 'images'], list: ['type', 'items'], divider: ['type'] })[itemValue?.type] || ['type'])
          : null;
        for (const sub of field.fields || []) {
          if (!elementFields || elementFields.has(sub.name)) card.append(addControl(sub, `${path}.${index}.${sub.name}`, itemValue?.[sub.name] ?? fieldDefault(sub)));
        }
        const actions = element('div', { class: 'section-repeat-actions' });
        const up = element('button', { type: 'button', 'aria-label': `Monter ${legend.textContent}` }, '↑');
        const down = element('button', { type: 'button', 'aria-label': `Descendre ${legend.textContent}` }, '↓');
        const remove = element('button', { type: 'button', 'aria-label': `Supprimer ${legend.textContent}` }, 'Supprimer');
        up.disabled = index === 0;
        down.disabled = index === list.length - 1;
        remove.disabled = schema?.name === 'zone-libre' && field.name === 'columns' && list.length <= 1;
        up.addEventListener('click', () => reorder(path, index, index - 1));
        down.addEventListener('click', () => reorder(path, index, index + 1));
        remove.addEventListener('click', () => { const next = (getAtPath(readData(selected, schema), path) || []).map(clone); next.splice(index, 1); commit(path, next); refresh(); });
        actions.append(up, down, remove);
        card.append(actions);
        rows.append(card);
      });
      const add = element('button', { type: 'button', class: 'section-repeat-add' }, `Ajouter ${field.label || field.name}`);
      add.disabled = Number.isInteger(field.max_items) && list.length >= field.max_items;
      add.addEventListener('click', () => {
        const next = (getAtPath(readData(selected, schema), path) || []).map(clone);
        next.push(Object.fromEntries((field.fields || []).map((sub) => [sub.name, fieldDefault(sub)])));
        commit(path, next);
        refresh();
      });
      group.append(rows, add);
      return group;
    }

    let control;
    let mediaBinding = null;
    if (field.kind === 'bool') {
      control = element('input', { type: 'checkbox', id, 'data-field-editor': path });
      control.checked = Boolean(value);
      control.addEventListener('change', () => commit(path, control.checked));
    } else if (field.kind === 'choice') {
      control = element('select', { id, 'data-field-editor': path });
      const parts = path.split('.');
      let choices = [...(field.choices || [])];
      if (schema?.name === 'zone-libre' && parts[0] === 'columns' && parts.length === 3 && parts[2] === 'span') {
        const count = (getAtPath(readData(selected, schema), 'columns') || []).length;
        const max = count <= 1 ? 12 : 12 - 2 * (count - 1);
        choices = choices.filter((choice) => Number(choice) <= max);
      }
      const isBackgroundChoice = field.name === 'section_background'
        || (schema?.name === 'zone-libre' && field.name === 'background' && parts.length === 1);
      for (const choice of choices) {
        const label = field.name === 'type' && choice === 'image-stack'
          ? 'Images empilées'
          : isBackgroundChoice ? (BACKGROUND_LABELS[choice] || choice) : choice;
        control.append(element('option', { value: choice }, label));
      }
      control.value = String(value ?? '');
      control.addEventListener('change', () => {
        commit(path, control.value);
        const spanChanged = schema?.name === 'zone-libre' && parts[0] === 'columns' && parts.length === 3 && parts[2] === 'span';
        const elementTypeChanged = schema?.name === 'zone-libre' && parts[0] === 'columns' && parts[2] === 'elements' && parts[4] === 'type';
        if (spanChanged || elementTypeChanged || isBackgroundChoice) refresh();
      });
    } else if (field.kind === 'number') {
      control = element('input', { type: 'number', id, 'data-field-editor': path });
      const isSpacing = /^(padding|margin)_(top|right|bottom|left)$/.test(field.name);
      if (isSpacing) {
        control.min = '0'; control.max = '240'; control.step = '1';
      }
      control.value = value == null || !Number.isFinite(Number(value)) ? '' : String(value);
      control.addEventListener('input', () => {
        const nextValue = control.value === '' ? null : Number(control.value);
        const invalidSpacing = isSpacing && nextValue !== null
          && (!Number.isInteger(nextValue) || nextValue < 0 || nextValue > 240);
        control.setCustomValidity(invalidSpacing ? 'Saisissez un nombre entier entre 0 et 240 px.' : '');
        if (invalidSpacing) {
          control.setAttribute('aria-invalid', 'true');
          return;
        }
        control.removeAttribute('aria-invalid');
        commit(path, nextValue === null ? (isSpacing ? null : 0) : nextValue);
      });
    } else if (field.kind === 'color') {
      control = element('input', { type: 'color', id, 'data-field-editor': path });
      const color = String(value || '#f2f2f4');
      control.value = /^#[0-9a-f]{6}$/i.test(color) ? color : '#f2f2f4';
      control.addEventListener('input', () => commit(path, control.value));
    } else if (field.kind === 'image') {
      control = element('select', { id, 'data-field-editor': path, 'aria-label': field.label || field.name });
      if (mediaClient?.populate) {
        mediaBinding = mediaClient.populate(control, String(value || ''), (src) => commit(path, src));
      }
    } else {
      control = element('textarea', { id, 'data-field-editor': path, 'data-field-kind': field.kind });
      control.value = Array.isArray(value) ? value.join('\n') : String(value ?? '');
      // Un champ vide n'est pas une erreur : le gabarit affiche alors son texte
      // d'origine. On le dit, sinon on croit que l'aperçu ne correspond pas.
      if (!control.value) control.placeholder = 'Vide : le thème affiche son texte par défaut';
      if (Number.isInteger(field.max_length)) control.maxLength = field.max_length;
      control.addEventListener('input', () => {
        const nextValue = field.kind === 'lines' && Array.isArray(value)
          ? control.value.split('\n')
          : control.value;
        commit(path, nextValue);
      });
    }
    control.dataset.fieldKind = field.kind;
    group.append(control);
    if (mediaBinding?.trigger && !mediaBinding.trigger.isConnected) group.append(mediaBinding.trigger);
    return group;
  }

  function reorder(path, from, to) {
    if (to < 0) return;
    const list = getAtPath(readData(selected, schema), path) || [];
    if (to >= list.length) return;
    const next = list.map(clone);
    [next[from], next[to]] = [next[to], next[from]];
    commit(path, next);
    refresh();
  }

  function refresh() {
    const component = selected;
    schema = component ? blockSchema?.[component.getAttributes?.()['data-sjd-section']] : null;
    panel.replaceChildren();
    if (!component || !schema) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    panel.dataset.changed = 'false';
    panel.append(element('h2', { class: 'section-panel-title' }, schema.label));
    const wrapper = editor.getWrapper();
    const siblings = wrapper.components();
    const position = siblings.indexOf(component);
    const order = element('div', { class: 'section-order-controls', role: 'group', 'aria-label': 'Ordre des sections' });
    const move = (offset, label, text) => {
      const button = element('button', { type: 'button', 'aria-label': label }, text);
      button.disabled = position < 0 || position + offset < 0 || position + offset >= siblings.length;
      button.addEventListener('click', () => {
        const from = siblings.indexOf(component);
        const to = from + offset;
        if (from < 0 || to < 0 || to >= siblings.length) return;
        const models = siblings.models.slice();
        const [current] = models.splice(from, 1);
        models.splice(to, 0, current);
        siblings.reset(models);
        editor.select(component);
        editor.trigger('update');
        refresh();
      });
      return button;
    };
    order.append(move(-1, 'Monter cette section', '↑ Monter'), move(1, 'Descendre cette section', '↓ Descendre'));
    panel.append(order);
    const data = readData(component, schema);
    const variants = Object.entries(schema.variants || {});
    if (variants.length) {
      const group = element('div', { class: 'section-field section-variant' });
      const select = element('select', { 'data-section-variant': '' });
      group.append(element('label', {}, 'Variante'));
      for (const [value, label] of variants) select.append(element('option', { value }, label));
      select.value = data._variant || variants[0][0];
      select.addEventListener('change', () => commit('_variant', select.value));
      group.append(select);
      panel.append(group);
    }
    // Regroupement des champs : sur une section comme le hero (27 champs), tout
    // aligner à plat rend le panneau illisible. Trois blocs repliables, la mise en
    // page fermée par défaut : on voit d'abord ce qu'on édite vraiment.
    const LAYOUT = /^(padding|margin)_|^section_background|^background$|^(dense|wide_title|shader|section_background_color)$/;
    const MEDIA = /(^|_)(cover|image|images|photo|video|alt|src)(_|$)|^(cover_alt|image_alt|image_width|image_height)$/;
    const groups = new Map();
    const fieldGroups = [
      ['contenu', 'Contenu', true],
      ['medias', 'Médias', false],
      ['mise-en-page', 'Mise en page', false],
    ];
    // On mémorise les blocs ouverts : chaque frappe reconstruit le panneau, et
    // sans ça le bloc « Médias » se refermait à chaque modification.
    for (const [key, label, open] of fieldGroups) {
      const box = element('details', { class: 'section-group', 'data-group': key });
      box.open = openGroups.size ? openGroups.has(key) : open;
      box.append(element('summary', {}, label));
      groups.set(key, box);
    }
    for (const field of schema.fields || []) {
      const group = addControl(field, field.name, data[field.name] ?? fieldDefault(field));
      if (field.name === 'section_background_color') {
        const mode = schema.name === 'zone-libre' ? data.background : data.section_background;
        group.hidden = mode !== 'custom';
        group.dataset.backgroundColorControl = '';
      }
      const key = LAYOUT.test(field.name) ? 'mise-en-page' : MEDIA.test(field.name) ? 'medias' : 'contenu';
      groups.get(key).append(group);
    }
    // Une couleur de fond choisie explicitement doit rester atteignable même
    // quand « Mise en page » est repliée.
    for (const [, box] of groups) {
      if (box.querySelector('.section-field')) panel.append(box);
    }
    if (panel.querySelector('[data-background-color-control]:not([hidden])')) {
      groups.get('mise-en-page').open = true;
      openGroups.add('mise-en-page');
    }
    // Une fois ouvert manuellement, le bloc reste ouvert aux rafraîchissements suivants.
    panel.querySelectorAll('.section-group').forEach((box) => {
      box.addEventListener('toggle', () => {
        if (box.open) openGroups.add(box.dataset.group); else openGroups.delete(box.dataset.group);
      });
    });
    const remove = element('button', {
      type: 'button',
      class: 'section-panel-delete',
      'data-section-delete': '',
      'aria-label': 'Supprimer cette section',
    }, 'Supprimer cette section');
    remove.addEventListener('click', () => {
      const target = selected;
      if (!target || !schema) return;
      const label = schema.label || 'section';
      if (!window.confirm(`Supprimer « ${label} » du brouillon ? La page publique ne changera qu’après publication.`)) return;
      selected = null;
      target.remove();
      refresh();
    });
    panel.append(remove);
  }

  editor.on('component:selected', (component) => {
    selected = component?.getAttributes?.()['data-sjd-section'] ? component : null;
    refresh();
  });
  editor.on('component:deselected', () => { selected = null; refresh(); });
  return { refresh, destroy() { editor.off('component:selected'); editor.off('component:deselected'); panel.replaceChildren(); } };
}
