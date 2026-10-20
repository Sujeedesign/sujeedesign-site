const f = (name, kind, label = name, extra = {}) => ({ name, kind, label, ...extra });
const t = (name, label = name, extra = {}) => f(name, 'text', label, extra);
const a = (name, label = name, extra = {}) => f(name, 'textarea', label, extra);
const l = (name, label = name) => f(name, 'lines', label);
const image = (name, label = name) => f(name, 'image', label);
const item = (name, kind, fields, label = name, extra = {}) => f(name, kind, label, { fields, ...extra });
const ctaFields = [t('label', 'Libellé'), t('href', 'Lien'), f('style', 'choice', 'Style', { choices: ['pill', 'pill--filled', 'text-link'] })];

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
].map(([name, label, fields, variants = {}]) => [name, { name, label, variants, repeatable: true, fields }]));
