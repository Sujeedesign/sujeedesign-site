export const PILOT_COMPONENT_TYPE = 'sjd-demo-section';

function findField(component, name) {
  const attributes = component.getAttributes?.() || {};
  if (attributes['data-sjd-field'] === name) return component;

  const children = component.components?.();
  if (!children) return null;
  for (const child of children.models) {
    const match = findField(child, name);
    if (match) return match;
  }
  return null;
}

export function registerPilotTheme(editor) {
  editor.DomComponents.addType(PILOT_COMPONENT_TYPE, {
    isComponent(element) {
      if (element?.nodeType !== 1) return false;
      return element.getAttribute('data-sjd-section') === 'pilot-demo'
        ? { type: PILOT_COMPONENT_TYPE }
        : false;
    },
    model: {
      defaults: {
        name: 'Section pilote',
        tagName: 'section',
        attributes: {
          'data-sjd-section': 'pilot-demo',
          'data-title': 'Titre de départ',
        },
        removable: true,
        draggable: 'body',
        droppable: false,
        traits: [
          { type: 'text', name: 'data-title', label: 'Titre' },
        ],
        components: [
          {
            tagName: 'div',
            attributes: { class: 'pilot-section__inner' },
            components: [
              {
                tagName: 'h2',
                attributes: { 'data-sjd-field': 'title' },
                content: 'Titre de départ',
                editable: true,
              },
              {
                tagName: 'p',
                attributes: { 'data-sjd-field': 'body' },
                content: 'Cette section appartient au thème du site.',
                editable: true,
              },
            ],
          },
        ],
      },
      init() {
        this.listenTo(this, 'change:attributes', this.syncTitle);
        this.syncTitle();
      },
      syncTitle() {
        const title = findField(this, 'title');
        const value = this.getAttributes()['data-title'] || '';
        if (title) title.set('content', String(value));
      },
    },
  });

  editor.Blocks.add('sjd-demo-section', {
    label: 'Section pilote',
    category: 'Sections',
    content: { type: PILOT_COMPONENT_TYPE },
    onClick(block, instance) {
      const added = instance.getWrapper().append(block.get('content'));
      const selected = Array.isArray(added) ? added[0] : added;
      if (selected) instance.select(selected);
    },
    select: true,
  });
}
