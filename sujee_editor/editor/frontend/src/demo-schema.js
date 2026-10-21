const f = (name, kind, label = name, extra = {}) => ({ name, kind, label, ...extra });
const t = (name, label = name, extra = {}) => f(name, 'text', label, extra);
const a = (name, label = name, extra = {}) => f(name, 'textarea', label, extra);
const l = (name, label = name) => f(name, 'lines', label);
const image = (name, label = name) => f(name, 'image', label);
const item = (name, kind, fields, label = name, extra = {}) => f(name, kind, label, { fields, ...extra });
const ctaFields = [t('label', 'Libellé'), t('href', 'Lien'), f('style', 'choice', 'Style', { choices: ['pill', 'pill--filled', 'text-link'] })];
const sectionBackgroundFields = [
  f('section_background', 'choice', 'Arrière-plan', { choices: ['default', 'paper', 'obsidian', 'accent', 'gradient', 'custom'], default: 'default' }),
  f('section_background_color', 'color', 'Couleur personnalisée', { default: '#f2f2f4' }),
];

export const DEMO_BLOCKS = Object.fromEntries([
  ['hero', "Bandeau d'ouverture", [t('kicker'), f('title', 'html-line', 'Titre'), a('intro'), l('meta'), l('rotator'), image('cover'), t('cover_alt'), image('image'), t('image_alt'), f('image_width', 'number'), f('image_height', 'number'), t('back_label'), t('back_href'), f('dense', 'bool'), f('wide_title', 'bool'), item('ctas', 'ctas', ctaFields, 'Boutons', { default: [{ label: 'Découvrir', href: '/services', style: 'pill' }] }), f('shader', 'bool')], { accueil: 'Accueil', page: 'Page interne', simple: 'Page simple', projet: 'Réalisation' }],
  ['manifeste', 'Manifeste', [t('label'), l('heading_lines'), a('text')]],
  ['realisations-grid', 'Grille de réalisations', [t('label'), l('heading_lines'), l('slugs'), f('limit', 'number'), t('all_label')], { auto: 'Automatique', manuel: 'Manuel' }],
  ['marquee', 'Bandeau défilant', [l('items')]],
  ['services-list', 'Liste des services', [t('label'), t('title'), l('slugs')], { auto: 'Automatique', manuel: 'Manuel' }],
  ['chapter', 'Chapitre éditorial', [t('kicker'), t('title'), f('body', 'html'), l('list'), f('dark', 'bool')]],
  ['texte-riche', 'Bloc de texte', [t('label'), t('title'), f('body', 'html')], { '1': 'Une colonne', '2': 'Deux colonnes' }],
  ['galerie', "Galerie d'images", [t('label'), item('images', 'images', [image('src'), t('alt'), t('caption')], 'Images'), f('columns', 'number')]],
  ['image-pleine-largeur', 'Image pleine largeur', [image('src'), t('alt'), t('caption')]],
  ['chiffres-cles', 'Chiffres clés', [t('label'), t('title'), item('items', 'items', [t('value'), t('label', 'Légende')], 'Chiffres')]],
  ['process', 'Étapes du process', [t('label'), t('title'), item('steps', 'items', [t('title'), a('text')], 'Étapes')]],
  ['citation', 'Citation', [a('quote'), t('author'), t('role')]],
  ['faq', 'Questions fréquentes', [t('label'), t('title'), item('items', 'items', [t('q', 'Question'), a('a', 'Réponse')], 'Questions')]],
  ['logos-clients', 'Logos clients', [t('label'), item('logos', 'images', [image('src'), t('alt')], 'Logos')]],
  ['cta-final', "Appel à l'action final", [t('kicker'), t('title'), l('title_lines'), a('intro'), item('ctas', 'ctas', ctaFields, 'Boutons'), f('shader', 'bool')], { interne: 'Interne', accueil: 'Accueil' }],
  ['formulaire-contact', 'Formulaire de contact', [t('label'), t('title'), a('intro'), t('aside_title'), item('columns', 'items', [t('title'), f('body', 'html')], 'Colonnes')]],
  ['bloc-liens', 'Bloc de liens', [t('label'), l('slugs'), f('exclude_current', 'bool')], { services: 'Services', realisations: 'Réalisations', manuel: 'Manuel' }],
  ['etude-de-cas', 'Étude de cas', [item('blocks', 'items', [f('kind', 'choice', 'Type', { choices: ['texte', 'liste', 'meta'] }), t('title'), f('body', 'html'), l('items'), l('meta')], 'Blocs')]],
  ['banniere', 'Bannière visuelle', [image('src'), t('alt'), f('svg', 'html')]],
  ['zone-libre', 'Section à composer', [
    f('background', 'choice', 'Arrière-plan', { choices: ['none', 'paper', 'obsidian', 'accent', 'gradient', 'custom', 'image'], default: 'none' }),
    sectionBackgroundFields[1],
    f('background_image', 'image', 'Image de fond'),
    f('width', 'choice', 'Largeur', { choices: ['container', 'full'], default: 'container' }),
    f('spacing', 'choice', 'Espacement vertical', { choices: ['compact', 'normal', 'generous'], default: 'normal' }),
    item('columns', 'items', [
      f('span', 'choice', 'Largeur de colonne', { choices: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '12'], default: '6' }),
      f('align', 'choice', 'Alignement', { choices: ['left', 'center', 'right'], default: 'left' }),
      item('elements', 'items', [
        f('type', 'choice', 'Type', { choices: ['heading', 'text', 'button', 'image', 'list', 'divider'], default: 'heading' }),
        f('text', 'html', 'Texte', { max_length: 4000 }),
        f('level', 'choice', 'Niveau du titre', { choices: ['h2', 'h3', 'h4'], default: 'h2' }),
        t('label', 'Libellé du bouton'), t('href', 'Lien du bouton'),
        f('role', 'choice', 'Style du bouton', { choices: ['principal', 'secondaire', 'lien'], default: 'principal' }),
        image('src', 'Image'), t('alt', 'Texte alternatif'), l('items', 'Éléments de la liste'),
      ], 'Éléments', { max_items: 8 }),
    ], 'Colonnes', { max_items: 3, default: [
      { span: '6', align: 'left', elements: [] }, { span: '6', align: 'left', elements: [] },
    ] }),
  ]],
].map(([name, label, fields, variants = {}]) => [name, {
  name,
  label,
  variants,
  repeatable: true,
  fields: [...fields, ...(name === 'zone-libre' ? [] : sectionBackgroundFields)],
}]));
