BANDEAUX, TYPOGRAPHIE ET LECTURE — 17 OCTOBRE 2026 (suite de la journée)

DEMANDE

1. Bandeaux hero de Réalisation, Services, À propos et Contact : hauteur
   identique et animation de dégradé.
2. Vérifier le style typographique de tout le site : « j'ai l'impression que
   c'est pas uniformisé ».
3. Améliorer la page À propos, « compliqué en lecture » (skill UI/UX Pro Max).
4. Dissocier le back office de l'admin du site, à relier plus tard.

DÉCISIONS

- **Une seule bande interne.** `.page-hero` (gabarit « simple ») et `.p-hero`
  (gabarit « page ») gardent deux contenus différents mais une seule apparence :
  un unique bloc CSS porte le fond, la hauteur et le rythme des deux. Les
  bandeaux de Réalisation, Services, À propos, Contact, Mentions légales et 404
  mesurent exactement la même hauteur (mesuré au navigateur : 595 px en
  1440x900, 569 en 1280x720, 629 en 1920x1080). La bande « dense » ne change
  plus la hauteur d'un pixel, seulement le rythme de la section suivante.
- **Le dégradé iridescent est animé** (`gradient-pan`, 26 s) sur les deux
  gabarits, exactement comme le hero d'accueil et la bande de contact. Le
  portrait qui servait de fond au gabarit « page » (chemin d'ailleurs cassé) est
  retiré : plus aucune trace du portrait sur le site.
- **La hauteur ne dépend pas du contenu** : le chapeau réserve 3 lignes, le
  titre 2 lignes, l'emplacement des actions est toujours rendu (même sans
  bouton), et les étiquettes du gabarit « page » sont ancrées au bas de la
  bande, hors du flux. Sans ces réserves, une page sans bouton aurait une bande
  plus courte de 76 px.
- **Typographie : un rôle, une seule valeur.** 33 tailles `clamp()` et 14
  interlettrages vivaient en dur dans la feuille ; il reste neuf jetons de rôle
  (`--fs-label`, `--fs-micro`, `--fs-body`, `--fs-lead`, `--fs-h3`, `--fs-h2`,
  `--fs-h1`, `--fs-display`, `--fs-hero`/`--fs-cover`) et deux interlettrages
  (`--ls-label` pour les sur-titres, `--ls-micro` pour les micro-capitales).
  Trois exceptions assumées et commentées : la boîte des boutons (16 px,
  verrouillée par les tests de CTA), le badge SVG de défilement et les glyphes
  de flèches.
- **Géométrie des actions** : les deux variantes mesuraient 55,6 px de haut
  (hauteur de ligne héritée) alors que la règle annonce 48 px. `line-height:1`
  les ramène aux 48 px documentés, sur les deux variantes, partout.

MESURE DE LISIBILITÉ DES BANDEAUX

Le fond est animé : le voile a été échantillonné sur un cycle complet, texte
masqué, pixels réels sous chaque zone, puis converti en contraste.

  zone                    pire cas du cycle   seuil
  titre                        6,92:1         3,0 (grand texte)
  chapeau                      7,04:1         4,5
  actions                      6,56:1         4,5
  étiquettes + liens de menu  12,5 à 13,8:1   4,5

Le voile superpose trois dégradés : une bande assombrie en haut (le menu est en
clair au-dessus de la bande), un dégradé horizontal (le texte vit à gauche, la
couleur reste visible à droite) et un pied légèrement assombri.

PAGE À PROPOS (CONFORT DE LECTURE)

- Le chapitre « Parcours » arrive de la base sous forme de liste nue, sans
  aucune classe : il s'affichait donc avec les puces et les titres par défaut du
  navigateur (h3 en gras à 18,72 px, hors échelle). Il est désormais mis en forme
  en frise : pastille ambre, rail vertical, année en micro-capitales, intitulé
  à l'échelle (`--fs-h3`), entreprise en petit, description en corps de texte.
  La mise en forme vit dans la feuille, pas dans les contenus.
- Mesure de lecture ramenée dans la bande 65-75 caractères (le texte éditorial
  passait 82 caractères par ligne) ; corps à 16 px, interligne 1,6.
- Blocs de fin (Clients, Behance, LinkedIn) : rythme resserré (140 px de marge
  verticale par bloc avant, 104 px après), listes de liens lisibles d'un coup
  d'œil (le lien d'abord, la date en micro-capitales atténuée dessous, filet de
  séparation entre les entrées).
- Aucun contenu modifié : ni en base, ni dans `seed/content.json`.

VÉRIFICATIONS

- 172 tests (dont 5 nouveaux : échelle typographique, interlettrages, bande
  unique, emplacement d'actions toujours rendu, mesure de lecture).
- Bandeaux mesurés au navigateur à 1280x720, 1440x900 et 1920x1080 : hauteurs
  identiques au pixel sur les six pages internes sans titre sur 3 lignes.
- Balayage de 12 routes à 1440 et 375 px : aucun débordement horizontal du
  document, un seul `h1` par page, boutons à 48 px et rayon 0 partout.

POINTS OUVERTS

- Les cinq pages de prestation portent un titre rédigé sur trois lignes
  (`Une marque<br>qui vous ressemble,<br>partout.`), donc une bande plus haute
  que les six autres. Normaliser suppose de raccourcir ces titres : à décider.
- Sur téléphone, deux titres passent à quatre lignes : la bande suit le contenu
  (impossible de faire tenir un titre de quatre lignes dans la boîte d'un titre
  de deux lignes).
- Back office : à dissocier du site (chantier séparé, voir les options
  proposées dans la conversation).
