const PILOT_COMPONENTS = {
  chapter: {
    type: 'sjd-section-chapter', tagName: 'section',
    attributes: { class: 's-chap reveal', 'data-sjd-dark': '0' },
    components: [{ tagName: 'div', attributes: { class: 'container' }, components: [{ tagName: 'div', attributes: { class: 'chap' }, components: [
      { tagName: 'div', attributes: { class: 'chap-head' }, components: [
        { tagName: 'span', attributes: { class: 'type', 'data-sjd-field': 'kicker' }, content: 'Sur-titre', editable: true },
        { tagName: 'h2', attributes: { class: 'chap-title', 'data-sjd-field': 'title' }, content: 'Titre du chapitre', editable: true },
      ] },
      { tagName: 'div', attributes: { class: 'chap-body' }, components: [
        { tagName: 'div', attributes: { class: 'chap-rich', 'data-sjd-field': 'body' }, components: [{ tagName: 'p', content: 'Ajoutez votre texte ici.' }] },
        { tagName: 'ul', attributes: { class: 'chap-list', 'data-sjd-field': 'list' }, components: [{ tagName: 'li', content: 'Premier élément' }] },
      ] },
    ] }] }],
  },
  'image-pleine-largeur': {
    type: 'sjd-section-image-pleine-largeur', tagName: 'section',
    attributes: { class: 'page-body reveal' },
    components: [{ tagName: 'figure', attributes: { class: 'full-bleed' }, components: [
      { type: 'image', tagName: 'img', attributes: { 'data-sjd-field': 'src', src: '', alt: '' } },
      { tagName: 'figcaption', attributes: { 'data-sjd-field': 'caption' }, content: 'Légende', editable: true },
    ] }],
  },
  citation: {
    type: 'sjd-section-citation', tagName: 'section',
    attributes: { class: 'citation reveal' },
    components: [{ tagName: 'div', attributes: { class: 'container' }, components: [{ tagName: 'blockquote', attributes: { class: 'quote' }, components: [
      { tagName: 'p', attributes: { class: 'quote-text', 'data-sjd-field': 'quote' }, content: 'Votre citation', editable: true },
      { tagName: 'footer', attributes: { class: 'quote-source' }, components: [
        { tagName: 'cite', attributes: { 'data-sjd-field': 'author' }, content: 'Nom de l’auteur', editable: true },
        { tagName: 'span', attributes: { class: 'quote-role', 'data-sjd-field': 'role' }, content: 'Fonction', editable: true },
      ] },
    ] }] }],
  },
};

function defaultFor(field) {
  if (Object.hasOwn(field, 'default')) return structuredClone(field.default);
  if (field.kind === 'bool') return false;
  if (field.kind === 'number') return 0;
  if (field.kind === 'choice') return field.choices?.[0] || '';
  if (['lines', 'items', 'images', 'ctas'].includes(field.kind)) return [];
  return '';
}

export function defaultSectionData(schema) {
  const data = Object.fromEntries((schema.fields || []).map((field) => [field.name, defaultFor(field)]));
  const variant = Object.keys(schema.variants || {})[0];
  if (variant) data._variant = variant;
  return data;
}

function genericPreview(name, schema) {
  return [{ tagName: 'div', attributes: { class: `sjd-editor-preview sjd-editor-preview-${name}` }, components: [
    { tagName: 'strong', attributes: { class: 'sjd-editor-preview-title' }, content: schema.label },
    { tagName: 'p', content: `${schema.fields?.length || 0} champs configurables · aperçu du bloc dynamique` },
  ] }];
}

export function createThemeComponents(blockSchema = {}) {
  const definitions = {};
  for (const [name, schema] of Object.entries(blockSchema)) {
    const pilot = PILOT_COMPONENTS[name];
    const type = pilot?.type || `sjd-section-${name}`;
    definitions[name] = {
      ...pilot,
      type,
      label: schema.label || name,
      tagName: pilot?.tagName || 'section',
      attributes: {
        ...(pilot?.attributes || { class: `sjd-editor-section sjd-editor-section-${name}` }),
        'data-sjd-section': name,
        'data-sjd-visible': '1',
        'data-sjd-variant': Object.keys(schema.variants || {})[0] || '',
        'data-sjd-data': JSON.stringify(defaultSectionData(schema)),
      },
      components: pilot?.components || genericPreview(name, schema),
    };
  }
  return definitions;
}

export const SECTION_COMPONENTS = Object.fromEntries(
  ['hero', 'manifeste', 'realisations-grid', 'marquee', 'services-list', 'chapter', 'texte-riche', 'galerie', 'image-pleine-largeur', 'chiffres-cles', 'process', 'citation', 'faq', 'logos-clients', 'cta-final', 'formulaire-contact', 'bloc-liens', 'etude-de-cas', 'banniere']
    .map((name) => [name, `sjd-section-${name}`]),
);
