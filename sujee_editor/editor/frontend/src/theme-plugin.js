const SECTION_TYPES = {
  chapter: {
    type: 'sjd-section-chapter', label: 'Chapitre éditorial', tagName: 'section',
    attributes: { class: 's-chap reveal', 'data-sjd-section': 'chapter', 'data-sjd-visible': '1', 'data-sjd-variant': '', 'data-sjd-dark': '0' },
    traits: [{ type: 'select', name: 'data-sjd-dark', label: 'Fond', options: [{ id: '0', name: 'Clair' }, { id: '1', name: 'Sombre' }] }],
    components: [{ tagName: 'div', attributes: { class: 'container' }, components: [{ tagName: 'div', attributes: { class: 'chap' }, components: [
      { tagName: 'div', attributes: { class: 'chap-head' }, components: [
        { tagName: 'span', attributes: { class: 'type', 'data-sjd-field': 'kicker' }, content: 'Sur-titre', editable: true },
        { tagName: 'h2', attributes: { class: 'chap-title', 'data-sjd-field': 'title' }, content: 'Titre du chapitre', editable: true },
      ] },
      { tagName: 'div', attributes: { class: 'chap-body' }, components: [
        { tagName: 'div', attributes: { 'data-sjd-field': 'body' }, components: [{ tagName: 'p', content: 'Ajoutez votre texte ici.' }] },
        { tagName: 'ul', attributes: { class: 'chap-list', 'data-sjd-field': 'list' }, components: [{ tagName: 'li', content: 'Premier élément' }] },
      ] },
    ] }] }],
  },
  'image-pleine-largeur': {
    type: 'sjd-section-image-pleine-largeur', label: 'Image pleine largeur', tagName: 'section',
    attributes: { class: 'page-body reveal', 'data-sjd-section': 'image-pleine-largeur', 'data-sjd-visible': '1', 'data-sjd-variant': '' },
    components: [{ tagName: 'figure', attributes: { class: 'full-bleed' }, components: [
      { type: 'image', tagName: 'img', attributes: { 'data-sjd-field': 'src', src: '', alt: '' }, traits: [{ name: 'alt', label: 'Texte alternatif' }] },
      { tagName: 'figcaption', attributes: { 'data-sjd-field': 'caption' }, content: 'Légende', editable: true },
    ] }],
  },
  citation: {
    type: 'sjd-section-citation', label: 'Citation', tagName: 'section',
    attributes: { class: 'citation reveal', 'data-sjd-section': 'citation', 'data-sjd-visible': '1', 'data-sjd-variant': '' },
    components: [{ tagName: 'div', attributes: { class: 'container' }, components: [{ tagName: 'blockquote', attributes: { class: 'quote' }, components: [
      { tagName: 'p', attributes: { class: 'quote-text', 'data-sjd-field': 'quote' }, content: 'Votre citation', editable: true },
      { tagName: 'footer', attributes: { class: 'quote-source' }, components: [
        { tagName: 'cite', attributes: { 'data-sjd-field': 'author' }, content: 'Nom de l’auteur', editable: true },
        { tagName: 'span', attributes: { class: 'quote-role', 'data-sjd-field': 'role' }, content: 'Fonction', editable: true },
      ] },
    ] }] }],
  },
};

export function registerSujeeTheme(editor) {
  for (const [key, definition] of Object.entries(SECTION_TYPES)) {
    editor.DomComponents.addType(definition.type, {
      isComponent(element) {
        if (element?.nodeType !== 1) return false;
        return element.getAttribute('data-sjd-section') === key ? { type: definition.type } : false;
      },
      model: {
        defaults: { ...definition, name: definition.label, removable: true, draggable: true, droppable: false, stylable: false, resizable: false },
        init() {
          if (key === 'chapter') {
            this.listenTo(this, 'change:attributes', this.syncDarkClass);
            this.syncDarkClass();
          }
          for (const field of this.find('[data-sjd-field]')) {
            const name = field.getAttributes()['data-sjd-field'];
            if (!['src', 'list'].includes(name)) {
              field.set({ editable: true, stylable: false, draggable: false, removable: false });
            }
          }
        },
        syncDarkClass() {
          const attrs = this.getAttributes();
          const classes = new Set((attrs.class || 's-chap reveal').split(' ').filter(Boolean));
          if (attrs['data-sjd-dark'] === '1') classes.add('dark');
          else classes.delete('dark');
          const nextClass = [...classes].join(' ');
          if (attrs.class !== nextClass) this.addAttributes({ class: nextClass });
        },
      },
    });
    editor.Blocks.add(definition.type, {
      label: definition.label, category: 'Sections du thème',
      content: { ...definition, type: definition.type, name: definition.label },
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
  for (const field of editor.getWrapper().find('[data-sjd-field]')) {
    const name = field.getAttributes()['data-sjd-field'];
    if (!['src', 'list'].includes(name) && !field.get('editable')) {
      field.set({ editable: true, stylable: false, draggable: false, removable: false });
    }
  }
}

export { SECTION_TYPES };
