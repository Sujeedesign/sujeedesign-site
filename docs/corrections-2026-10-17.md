CORRECTIONS DU 17 OCTOBRE 2026 — HERO D'ACCUEIL ET SYSTÈME DE CTA

DEMANDE

1. Hero de la page d'accueil : contenu centré.
2. Suppression du portrait.
3. Harmonisation des CTA sur tout le site, avec une décision de forme : coins
   carrés ou coins arrondis.

DÉCISION DE FORME

Coins carrés (0 px) partout. Le système était déjà carré (cartes, images,
champs : --radius-cards/images/inputs/large = 0 px) et le pill 75 px restait la
seule exception : --radius-buttons et --radius-tags passent à 0 px. L'arrondi
aurait obligé à arrondir aussi les cartes, les images et les champs.

HERO D'ACCUEIL

- Le bloc portrait est retiré du gabarit (markup, CSS .hero-figure/.hero-float/
  .hero-photo/.hero-photo-shadow, animations floaty/floaty-shadow, inclinaison
  du portrait au curseur dans site.js) ainsi que la mise en page deux colonnes
  au-delà de 720 px.
- Le contenu repasse en colonne unique centrée à toutes les largeurs : bande de
  lecture plafonnée à 1080 px, titre rotatif centré (les mots se replient au lieu
  de déborder), actions centrées sous le titre.
- Le champ « Portrait » disparaît du schéma du back office. La donnée reste en
  base (réversible) et l'image /assets/sujeepan_sabesan.jpg est conservée : plus
  rien ne la référence.
- Le voile latéral .hero::before (qui détachait le texte du portrait) est
  supprimé ; un voile centré le remplace, dimensionné sur des mesures.

MESURE DE LISIBILITÉ (le fond est animé, la mesure est obligatoire)

Le shader fait passer une zone claire (jusqu'à une luminance de 1,0) sous le
texte : le voile a été calé en échantillonnant le fond sur un cycle complet
(10 à 16 images par format, pire pixel rencontré sous chaque ligne de texte et
sous chaque action), puis mesuré au navigateur :

  format      titre (pire cas)   action secondaire
  1440x900        5,51:1              12,02:1
  1024x768        5,36:1               6,89:1
  768x1024        5,60:1               6,08:1
  375x667        13,83:1               6,05:1
  390x844        16,43:1               6,19:1

Le titre est du texte de grande taille (3:1 suffit en AA) ; les libellés
d'action sont du texte courant : 4,5:1 visé, obtenu partout. Action principale
ambre : encre sur ambre = 6,35:1.

Sur mobile le titre occupe toute la largeur : le voile elliptique y était trop
faible sur les bords, remplacé par un dégradé vertical (le fond brut n'est clair
que dans la bande médiane).

SYSTÈME DE CTA

Trois rôles, une seule géométrie (48 px de haut, padding 14x32, 16 px / 500,
flèche espacée de 12 px, remontée de 2 px au survol) :

- action principale : .pill--filled, ambre, une au maximum par section ;
- action secondaire : .pill, contour, fond noir à 50 % sur fond animé ;
- lien tertiaire : .text-link, jamais de flèche, 44 px de zone de tap.

Corrections de cohérence survenues en harmonisant :

- Le CTA final réinventait la boucle des actions : il passe par la macro
  partagée, donc un lien texte n'y récolte plus de flèche (« LinkedIn → »).
- « Voir toutes les réalisations » (grille d'accueil) était un bouton contour en
  doublon avec le CTA final : passé en lien tertiaire.
- « LinkedIn » était un bouton contour sur À propos et un lien texte ailleurs :
  un seul rôle, lien texte (jeu de données livré ; la base de production reste à
  aligner).
- Bug trouvé au passage : le bouton d'envoi du formulaire (classes pill +
  pill--filled) était écrasé par la règle des boutons pâles (spécificité) et
  n'était donc pas ambre. La règle exclut maintenant la variante pleine.
- Les images distantes déclarent enfin leurs dimensions intrinsèques (bandeau),
  ce qui garde le contrôle de décalage (CLS) exercé par les tests.

VÉRIFICATIONS

- 167 tests (dont 10 nouveaux) : suite complète hors e2e au vert.
- Mesures DOM au navigateur à 1440, 1024, 768, 375 et 390 px : centre du titre et
  des actions aligné sur le centre de la fenêtre, aucun portrait rendu, rayon 0 px
  et hauteur 48 px sur les deux variantes, premier écran complet (actions à
  344 px de haut sur un écran de 667 px).
- Contraste mesuré au pixel (tableau ci-dessus).
