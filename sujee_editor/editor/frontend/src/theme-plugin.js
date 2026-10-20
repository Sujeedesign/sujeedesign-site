import { createThemeComponents, defaultSectionData, SECTION_COMPONENTS } from './theme-components.js';

function dataFor(component, schema) {
  try {
    return { ...defaultSectionData(schema), ...JSON.parse(component.getAttributes()['data-sjd-data'] || '{}') };
  } catch {
    return defaultSectionData(schema);
  }
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
          for (const field of this.find('[data-sjd-field]')) {
            const fieldName = field.getAttributes()['data-sjd-field'];
            if (!['src', 'list'].includes(fieldName)) {
              field.set({ editable: true, stylable: false, draggable: false, removable: false });
              this.listenTo(field, 'change:content', () => this.syncInlineField(fieldName, field));
            }
          }
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

export function prepareThemeProject(editor) {
  for (const component of editor.getWrapper().find('[data-sjd-section]')) {
    const sectionName = component.getAttributes()['data-sjd-section'];
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
