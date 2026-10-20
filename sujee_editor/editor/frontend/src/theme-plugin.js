import { createThemeComponents, defaultSectionData, SECTION_COMPONENTS } from './theme-components.js';

function dataFor(component, schema) {
  try {
    return { ...defaultSectionData(schema), ...JSON.parse(component.getAttributes()['data-sjd-data'] || '{}') };
  } catch {
    return defaultSectionData(schema);
  }
}

function previewText(value) {
  if (typeof value === 'string') {
    const markup = value
      .replaceAll('<br>', ' ')
      .replaceAll('<br/>', ' ')
      .replaceAll('<br />', ' ')
      .replaceAll('</p>', ' ')
      .replaceAll('</div>', ' ')
      .replaceAll('</li>', ' ');
    const text = new DOMParser().parseFromString(markup, 'text/html').body.textContent || '';
    return text.replaceAll(String.fromCharCode(10), ' ').replaceAll(String.fromCharCode(9), ' ').split(' ').filter(Boolean).join(' ');
  }
  if (typeof value === 'number') return value ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'Activé' : '';
  if (Array.isArray(value)) return value.map(previewText).filter(Boolean).join(' · ');
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([key]) => !['href', 'style', 'kind', '_variant', 'src', 'path', 'alt'].includes(key))
      .map(([, child]) => previewText(child))
      .filter(Boolean)
      .join(' · ');
  }
  return '';
}

function safePreviewImage(value) {
  if (typeof value !== 'string' || !(value.startsWith('/assets/') || value.startsWith('/medias/'))) return false;
  return !value.split('/').some((part) => part === '.' || part === '..');
}

function collectPreviewImages(value) {
  if (Array.isArray(value)) return value.flatMap(collectPreviewImages);
  if (!value || typeof value !== 'object') return [];
  const source = value.src || value.path;
  if (safePreviewImage(source)) return [{ src: source, alt: String(value.alt || value.caption || '') }];
  return Object.entries(value)
    .filter(([key]) => !['href', 'style', 'kind', '_variant', 'alt', 'caption'].includes(key))
    .flatMap(([, child]) => collectPreviewImages(child));
}

function imagePreview(source, alt) {
  return {
    type: 'image', tagName: 'img',
    attributes: { class: 'sjd-editor-preview-image', src: source, alt },
    editable: false, removable: false, draggable: false,
  };
}

function dynamicPreview(name, schema, data) {
  const components = [{
    tagName: 'strong', attributes: { class: 'sjd-editor-preview-title' }, content: schema.label || name,
  }];
  for (const field of schema.fields || []) {
    const value = data[field.name];
    if (field.kind === 'image') {
      if (safePreviewImage(value)) {
        components.push(imagePreview(value, String(data[`${field.name}_alt`] || field.label || '')));
      }
      continue;
    }
    if (field.kind === 'images') {
      for (const image of collectPreviewImages(value)) components.push(imagePreview(image.src, image.alt));
    }
    const text = previewText(value);
    if (!text) continue;
    components.push({
      tagName: 'div',
      attributes: { class: 'sjd-editor-preview-field' },
      components: [
        { tagName: 'span', attributes: { class: 'sjd-editor-preview-label' }, content: field.label || field.name, editable: false },
        { tagName: 'p', attributes: { class: 'sjd-editor-preview-value' }, content: text, editable: false },
      ],
      editable: false,
      removable: false,
      draggable: false,
    });
  }
  return [{
    tagName: 'div',
    attributes: { class: `sjd-editor-preview sjd-editor-preview-${name}` },
    components,
    editable: false,
    removable: false,
    draggable: false,
  }];
}

export function registerSujeeTheme(editor, blockSchema = {}) {
  const definitions = createThemeComponents(blockSchema);
  for (const [key, definition] of Object.entries(definitions)) {
    const schema = blockSchema[key];
    const componentId = SECTION_COMPONENTS[key] || `sjd-section-${key}`;
    const defaults = {
      ...definition,
      type: componentId,
      name: definition.label,
      removable: true,
      draggable: true,
      droppable: false,
      stylable: false,
      resizable: false,
      traits: key === 'chapter' ? [{ type: 'select', name: 'data-sjd-dark', label: 'Fond', options: [{ id: '0', name: 'Clair' }, { id: '1', name: 'Sombre' }] }] : [],
    };
    editor.DomComponents.addType(componentId, {
      isComponent(element) {
        if (element?.nodeType !== 1) return false;
        return element.getAttribute('data-sjd-section') === key ? { type: componentId } : false;
      },
      model: {
        defaults,
        init() {
          this.listenTo(this, 'change:attributes', this.syncThemeAttributes);
          if (key === 'chapter') this.syncDarkClass();
          else if (!['image-pleine-largeur', 'citation'].includes(key)) {
            this.listenTo(this, 'change:attributes', this.syncDynamicPreview);
            this.syncDynamicPreview();
          }
          for (const field of this.find('[data-sjd-field]')) {
            const fieldName = field.getAttributes()['data-sjd-field'];
            if (!['src', 'list'].includes(fieldName)) {
              field.set({ editable: true, stylable: false, draggable: false, removable: false });
              this.listenTo(field, 'change:content', () => this.syncInlineField(fieldName, field));
            }
          }
        },
        syncDynamicPreview() {
          if (!schema) return;
          this.components(dynamicPreview(key, schema, dataFor(this, schema)));
        },
        syncThemeAttributes() {
          if (key !== 'chapter') return;
          this.syncDarkClass();
        },
        syncDarkClass() {
          const attrs = this.getAttributes();
          const dark = attrs['data-sjd-dark'] === '1';
          const classes = new Set((attrs.class || 's-chap reveal').split(' ').filter(Boolean));
          if (dark) classes.add('dark');
          else classes.delete('dark');
          const current = dataFor(this, schema);
          if (Boolean(current.dark) !== dark) {
            current.dark = dark;
            this.addAttributes({ 'data-sjd-data': JSON.stringify(current), class: [...classes].join(' ') });
          } else if (attrs.class !== [...classes].join(' ')) {
            this.addAttributes({ class: [...classes].join(' ') });
          }
        },
        syncInlineField(name, field) {
          const current = dataFor(this, schema);
          current[name] = field.get('content') || '';
          this.addAttributes({ 'data-sjd-data': JSON.stringify(current) });
        },
      },
    });
    editor.Blocks.add(componentId, {
      label: definition.label,
      category: 'Sections du thème',
      content: structuredClone(definition),
      onClick(block, instance) {
        const added = instance.getWrapper().append(block.get('content'));
        const selected = Array.isArray(added) ? added[0] : added;
        if (selected) instance.select(selected);
      },
      select: true,
    });
  }
}

export function prepareThemeProject(editor, blockSchema = {}) {
  for (const component of editor.getWrapper().find('[data-sjd-section]')) {
    const sectionName = component.getAttributes()['data-sjd-section'];
    if (!['chapter', 'image-pleine-largeur', 'citation'].includes(sectionName)) {
      const schema = blockSchema[sectionName];
      if (schema) {
        const attrs = component.getAttributes();
        const classes = new Set(String(attrs.class || '').split(' ').filter(Boolean));
        classes.add('sjd-editor-section');
        classes.add(`sjd-editor-section-${sectionName}`);
        const className = [...classes].join(' ');
        if (attrs.class !== className) component.addAttributes({ class: className });
        component.components(dynamicPreview(sectionName, schema, dataFor(component, schema)));
      }
      continue;
    }
    if (sectionName === 'chapter') {
      const attrs = component.getAttributes();
      const data = dataFor(component, { fields: [] });
      if (typeof data.dark === 'boolean' && attrs['data-sjd-dark'] !== (data.dark ? '1' : '0')) {
        component.addAttributes({ 'data-sjd-dark': data.dark ? '1' : '0' });
      }
    }
    for (const field of component.find('[data-sjd-field]')) {
      const name = field.getAttributes()['data-sjd-field'];
      if (!['src', 'list'].includes(name) && !field.get('editable')) {
        field.set({ editable: true, stylable: false, draggable: false, removable: false });
      }
    }
  }
}
