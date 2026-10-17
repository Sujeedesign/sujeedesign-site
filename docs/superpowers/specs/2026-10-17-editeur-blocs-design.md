# Éditeur de blocs réutilisable — un admin « façon Squarespace » pour les sites Sujee

Date : 17 octobre 2026
Statut : conception validée en conversation, à relire avant écriture du plan

## 1. Objectif

Remplacer l'admin actuel (listes de champs) par un éditeur visuel qui se branche
sur n'importe quel site construit avec notre stack, et pas seulement sur
sujeedesign.com.

- Sujee édite son site en cliquant dessus : le texte se modifie là où il
  s'affiche, un panneau latéral règle le bloc, une palette ajoute des blocs.
- Le même éditeur sert pour les sites clients : le paquet est une dépendance,
  pas une copie. Un nouveau site branche l'éditeur sans le modifier.
- Le contenu reste dans la base du site (SQLite), rendu côté serveur (FastAPI +
  Jinja2), déployé par Coolify : même exploitation qu'aujourd'hui, une
  application par site.

Suite directe de la journée du 17 octobre : l'échelle typographique, les
bandeaux et le confort de lecture viennent d'être unifiés ; l'éditeur doit
respecter ces jetons et ne jamais produire de style en dur.

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Approche | A : paquet de blocs réutilisable + éditeur en place, livré comme dépendance |
| Stack des futurs sites | La nôtre : FastAPI + Jinja2 + SQLite, déployée sur Coolify |
| Style d'édition | Édition en place sur la page publique, panneau latéral par bloc, palette d'ajout |
| Contenu | Deux niveaux : blocs dessinés (identité du thème) et zone libre bornée (conteneur, colonnes, éléments) |
| Liberté de style | Aucune : uniquement les jetons du thème (couleurs, échelle, coins, espacements) |
| Adresse | On garde `/admin` pour l'instant, l'adresse dédiée est reportée |
| Sous-domaine | Hors périmètre de cette spec |
| Multi-utilisateurs | Hors périmètre (un seul compte, comme aujourd'hui) |

## 3. Périmètre

**Dans le périmètre, phase par phase** (détail en section 10) : édition en place
des blocs existants, panneau de bloc généré par schéma, rail des blocs
(réordonner, dupliquer, masquer, supprimer, ajouter), brouillon et publication,
révisions restaurables, zone libre (conteneur, colonnes, éléments), extraction
du paquet, puis confort (glisser-déposer, aperçu mobile).

**Hors périmètre, assumé** : multi-utilisateurs et rôles, publication
programmée, bibliothèque de modèles de pages, A/B testing, analytics,
installation de thèmes depuis l'interface, édition sur petits écrans en place.
Aucun de ces points n'entre sans demande explicite.

**Non-objectif** : transformer le site en page-builder généraliste. L'éditeur
compose dans un cadre dessiné ; il ne remplace pas la direction artistique.

## 4. L'expérience d'édition

### 4.1 Entrer et sortir

- Un bouton « Modifier » en haut de la page, rendu uniquement quand la session
  admin est valide. Le mode édition s'active par `?edit=1` (URL partageable et
  rechargement sans perte de contexte).
- En mode édition, chaque bloc porte un liseré discret et son étiquette au
  survol (« Héros », « Chapitre », « Grille réalisations »). Un clic sélectionne
  le bloc, un double clic sélectionne le texte visé.
- Le mode édition n'est jamais rendu pour un visiteur : la session est vérifiée
  côté serveur, pas seulement côté client.
- Sur écran étroit (< 900 px), pas d'édition en place : le panneau prend tout
  l'écran, la sélection d'un bloc par le rail, le texte dans un champ de saisie.
  Éditer un titre de 68 px au doigt sur 375 px ne fonctionne pas.

### 4.2 Les trois surfaces

1. **Le rail des blocs** (colonne verticale, repliable) : la page dans l'ordre.
   Chaque ligne porte le libellé du bloc et son type. Actions : sélectionner,
   monter, descendre, dupliquer, masquer/afficher, supprimer, et « Ajouter un
   bloc » qui ouvre la palette des types disponibles pour ce site.
2. **Le panneau du bloc** (latéral droit) : les champs du type sélectionné,
   générés depuis le schéma du bloc. Rien d'autre : pas d'onglets génériques,
   pas de champs vides. Le panneau s'adapte au type (texte, texte long, liste,
   image, booléen, choix, lien).
3. **Le canevas** : la page publique telle qu'elle s'affichera, avec les
   éléments éditables marqués. Cliquer un texte ouvre son champ et le curseur se
   place dans le mot cliqué.

### 4.3 Brouillon, publication, histoire

- Chaque modification est écrite en brouillon, invisible en public.
- « Publier » recopie le brouillon dans les données publiées de la page et
  crée un point de restauration.
- « Revenir à… » liste les révisions (horodatées, avec l'auteur) et restaure
  l'état choisi, en brouillon, pour vérification avant publication.
- Un indicateur permanent dit où l'on en est : « modifié », « publié il y a
  5 minutes », « brouillon non publié ».
- La publication porte sur la page entière en phase 1 ; publier un seul bloc
  viendra en phase 4 seulement si l'usage le réclame.

### 4.4 Les pages elles-mêmes

L'éditeur reprend aussi la gestion des pages, aujourd'hui faite dans l'admin :

- **Créer** une page : titre, adresse, et un premier bloc au choix. Une page
  créée est en brouillon et hors menu par défaut.
- **Renommer** : changer le titre ne change pas l'adresse. Changer l'adresse
  écrit automatiquement une redirection 301 de l'ancienne vers la nouvelle (la
  table `redirections` existe déjà et ces redirections sont déjà servies).
- **Menu** : afficher ou masquer la page dans le menu, changer son libellé de
  menu et sa position.
- **Réglages de page** : titre et description de référencement, image de
  partage, indexation. Ces champs existent déjà dans la table `pages`.
- **Supprimer** : confirmation explicite, avec le nombre de blocs concernés, et
  révision restaurable.

### 4.5 Ce qui reste dans l'admin actuel

Pendant la transition et au-delà : les messages reçus, les réglages du site, la
sauvegarde et l'export, la gestion des médias, et la liste des redirections
(l'éditeur en écrit une automatiquement quand une adresse change, mais leur
relecture reste ici). L'éditeur remplace les écrans « pages » et « sections » ;
il ne remplace pas l'exploitation.

## 5. Le modèle de contenu

### 5.1 Niveau 1 — les blocs dessinés

Chaque type de bloc du thème (les 19 types déjà déclarés dans
`app/sections.py`, du héros au formulaire de contact) déclare :

- son nom technique et son libellé d'édition,
- ses champs (nom, type, libellé, obligatoire, longueur maximale, valeurs
  possibles),
- ses variantes éventuelles (`variant`, déjà supporté aujourd'hui),
- son gabarit Jinja,
- s'il est répétable dans une page.

Le gabarit reçoit exactement ce qu'il reçoit aujourd'hui : un objet section avec
`.type`, `.variant`, `.label`, `.visible`, `.data`. Les 19 gabarits existants
continuent de fonctionner sans réécriture. Mieux : le type et le gabarit sont déjà
en correspondance exacte (19 types déclarés dans `app/sections.py`, 19 gabarits
dans `theme/templates/sections/`) ; le registre du paquet reprend cette liste
existante au lieu d'en inventer une.

### 5.2 Niveau 2 — la zone libre

Un type de bloc `zone-libre` porte une composition bornée :

- **conteneur** : un seul niveau, avec fond (clair, sombre, aucun) et largeur
  (pleine page, conteneur) ;
- **colonnes** : 2 ou 3, dont les largeurs se répartissent sur une grille de 12
  (6+6, 8+4, 4+4+4, 7+5…) ;
- **éléments** : titre, texte, bouton, image, liste, séparateur. Un élément ne
  contient jamais un conteneur.

Contraintes, volontaires et vérifiées côté serveur : profondeur maximale de
trois niveaux, somme des colonnes égale à 12, types d'éléments limités au jeu
autorisé par le site, aucune couleur ni taille de police libre. Les seuls
réglages de style exposés sont ceux du thème : niveau de titre, rôle d'action
(principal, secondaire, lien), alignement, fond.

Cette zone est ce qui permet de monter une page que le thème n'avait pas prévue,
sans casser le langage visuel : on compose dans les jetons, on ne redessine pas.

## 6. Architecture technique

### 6.1 Le paquet

Nom de travail : `sujee_editor`, installable depuis git
(`pip install git+https://github.com/Sujeedesign/sujee-editor.git`). Quatre
modules, un rôle chacun.

| Module | Rôle | Dépend de |
|---|---|---|
| `blocks/` | Registre des types de blocs : schéma, libellés, gabarit, validation | Rien du site |
| `store/` | Lecture et écriture du contenu : pages, blocs, ordre, brouillon, publication, révisions, médias | La base du site (SQLite) |
| `routes/` | API et écrans d'administration : session, CSRF, contenu, ordre, publier, révisions, médias, noindex | `store/`, `blocks/` |
| `editor/` | Fichiers statiques de l'éditeur (JS, CSS) et le point d'accroche à poser dans le gabarit | Les trois précédents, par l'API seulement |

Règle de dépendance : `blocks/` ne connaît ni la base ni le site ; `store/`
connaît la base mais aucun gabarit ; `editor/` ne connaît que l'API. Un site
supprime son thème, le paquet ne s'en aperçoit pas.

### 6.2 Le contrat central : le schéma d'un bloc

```python
hero = Block(
    name="hero",
    label="Bandeau d'ouverture",
    fields=[
        Field("kicker", kind=Kind.TEXT, label="Sur-titre", max_length=60),
        Field("title", kind=Kind.RICH_LINE, label="Titre", required=True),
        Field("intro", kind=Kind.RICH, label="Chapeau", max_length=320),
        Field("ctas", kind=Kind.CTAS, label="Actions", max_items=2),
    ],
    variants={"accueil": "Accueil", "simple": "Page", "projet": "Réalisation"},
    template="sections/hero.html",
)
```

Trois usages sortent du même objet, et c'est ce qui évite la dérive :

- le **panneau** est généré depuis `fields` ;
- la **validation** est dérivée de `fields` (type, obligatoire, longueur) ;
- le **contrat d'édition** (quels nœuds du DOM sont éditables) est vérifié par
  un test qui compare les `data-field` présents dans le gabarit rendu aux noms de
  `fields`.

Un champ déclaré et absent du gabarit, ou l'inverse, fait échouer les tests.

### 6.3 Accroches dans la page publique

Le rendu des sections ajoute, en un seul endroit (le moteur de rendu des
sections, pas dans les 19 gabarits), une enveloppe par bloc :

```html
<div data-block-id="412" data-block-type="chapter" data-block-label="Chapitre">
  … gabarit du bloc, avec data-field="title" sur les nœuds éditables …
</div>
```

Exigence sur les gabarits du site : marquer les nœuds éditables par
`data-field="<nom du champ>"`. C'est la seule discipline demandée à un site.
Le paquet fournit un gabarit vérifié de référence et un test qui refuse un bloc
dont les champs déclarés ne sont pas trouvables.

### 6.4 Stockage

Le schéma actuel convient déjà : les tables `pages`, `sections`, `medias`,
`revisions`, `reglages` du site sont exactement celles dont l'éditeur a besoin
(le paquet ne les recrée pas, il exige qu'elles existent et il les valide au
démarrage).

Un seul ajout de schéma : une colonne `draft` (JSON, nullable) sur `sections`,
pour que les modifications ne soient pas publiques avant publication. Migration
idempotente au démarrage (`ALTER TABLE` si la colonne manque), les données
publiées ne bougent pas. `revisions` reste la mémoire longue.

### 6.5 Flux de données

**Ouvrir une page en édition** : `GET <chemin de la page>?edit=1` en session → le serveur rend
le brouillon à la place des données publiées, plus les enveloppes de blocs et le
script de l'éditeur. Sans session, `?edit=1` est ignoré : la page publique
normale, brouillon jamais rendu.

**Modifier un champ** : le canevas écrit en mémoire, l'éditeur envoie
`PATCH /api/admin/sections/<id>` avec le champ modifié, le jeton CSRF et
l'en-tête `Origin`. Le serveur valide selon le schéma (type, longueur,
appartenance du champ au bloc), écrit dans `draft`, et renvoie l'état daté. Un
`PUT /api/admin/sections/<id>/draft` accepte un brouillon complet (utile au
canevas quand plusieurs champs changent d'un coup).

**Réordonner, dupliquer, masquer, supprimer** : routes dédiées
(`/sections/<id>/move`, `/duplicate`, `/toggle`, `DELETE`), toutes validées par
les mêmes règles, toutes tracées en révision.

**Publier** : `POST /api/admin/pages/<id>/publish` recopie `draft` dans `data`
pour tous les blocs de la page en une transaction, crée une révision de page
(snapshot complet, donc restaurable) et vide les brouillons. Après publication,
la page publique est identique, octet pour octet, à ce que le canevas montrait.

**Restaurer** : `POST /api/admin/pages/<id>/restore/<revision_id>` réécrit le
snapshot dans `draft` (jamais directement en publié), l'éditeur recharge le
canevas, Sujee vérifie puis publie.

### 6.6 Le paquet dans un nouveau site

```python
from sujee_editor import Editor, blocks as sujee_blocks

editor = Editor(
    db_path=settings.db_path,
    templates="theme/templates",
    media_dir=settings.media_dir,
    blocks=[sujeed_blocks.hero, sujee_blocks.chapter, mon_theme.prix, …],
    session_secret=settings.session_secret,
    admin_password_hash=settings.admin_password_hash,
)
app.include_router(editor.router)          # /admin, /api/admin/*
app.mount("/assets/editor", editor.assets) # l'éditeur
```

Une ligne dans le gabarit de base :
`{% include "editor/bootstrap.html" %}`.

Ce qu'un site client écrit : ses jetons de design, ses gabarits de blocs, la
liste des blocs activés. Ce qu'il n'écrit jamais : l'éditeur, le stockage, les
révisions, la session, la validation, les médias.

**Mise à jour** : `pip install -U` chez le client, la dernière version de
l'éditeur arrive sans toucher au design, tant que le contrat de schéma n'a pas
changé de façon incompatible (version majeure du paquet).

## 7. Erreurs et sécurité

- **Écriture refusée par la validation** : le serveur renvoie le champ fautif et
  la règle violée ; l'éditeur remet la valeur précédente dans le canevas et
  affiche l'erreur sur le champ. Jamais d'écriture partielle silencieuse.
- **Session expirée** : `401`, le canevas passe en lecture seule et propose de se
  reconnecter, les modifications non publiées sont conservées en local et
  reprises après reconnexion.
- **Conflit d'écriture** (deux onglets ouverts) : la colonne `draft` est
  accompagnée d'un `draft_version` entier, incrémenté à chaque écriture ;
  une écriture qui annonce une version dépassée est refusée (`409`) et
  l'éditeur propose de recharger plutôt que d'écraser.
- **Publication** : transaction unique. En cas d'échec, la page publique reste
  dans son état précédent, complet.
- **Sécurité, réutilisée du site actuel** : session signée HMAC, mot de passe
  hors dépôt, jeton CSRF par session sur chaque écriture, contrôle de l'en-tête
  `Origin`, `noindex,nofollow` sur l'admin, `/admin` interdit par `robots.txt`,
  limitation des tentatives de connexion.
- **XSS** : les champs riches sont nettoyés côté serveur par une liste blanche de
  balises et d'attributs ; l'éditeur n'insère jamais de contenu serveur par
  `innerHTML` sans échappement.
- **Médias** : types et tailles vérifiés, images servies depuis le volume du
  site, jamais écrites dans l'image de conteneur (le volume `/data` est
  obligatoire, piège déjà payé).

## 8. Tests et vérification

- **Unitaire** : validation des schémas (champ inconnu, valeur trop longue,
  obligatoire manquant, somme de colonnes fausse, profondeur dépassée).
- **Contrat** : chaque bloc déclaré a un gabarit existant ; chaque champ déclaré
  est présent dans le rendu du gabarit, et réciproquement. Ce test est la
  garantie que le panneau ne propose pas de champ fantôme.
- **Intégration** : par l'API, modifier un champ, publier, vérifier la page
  publique ; vérifier qu'un brouillon n'est jamais servi à un visiteur, même
  avec `?edit=1` sans session.
- **Non-régression du site** : les 172 tests actuels restent verts, et les 15
  pages rendent exactement le même HTML après l'ajout des enveloppes de blocs
  (hors attributs `data-*`), ce qui protège le référencement et le design.
- **Bout en bout** : parcours navigateur réel sur la recette, puis sur la
  production : sélectionner un bloc, modifier un titre, publier, recharger en
  visiteur, constater le changement, restaurer la révision précédente.
- **Mesures** : les hauteurs de bandeaux, la mesure de lecture, les contrastes et
  l'échelle typographique sont déjà verrouillés par les tests de la matinée ;
  l'éditeur doit les laisser passer au vert.

## 9. Migration du site actuel

1. Le paquet est développé **dans le dépôt du site**, derrière son interface,
   puis extrait (phase 3). Aucune double vérité : le site consomme le paquet dès
   la phase 1.
2. Les gabarits de blocs ne changent qu'en un point : les nœuds éditables
   reçoivent `data-field`. Les enveloppes de blocs sont posées par le moteur de
   rendu, pas dans les gabarits.
3. L'admin actuel reste accessible pendant la transition : les messages, les
   réglages, la sauvegarde, les redirections et les médias continuent d'y vivre.
4. Les écrans « pages » et « sections » de l'admin actuel sont retirés quand
   l'éditeur fait tout ce qu'ils faisaient, page par page, jamais avant.
5. Déploiement : recette d'abord, vérification de ce qui est réellement servi,
   puis production. La migration de base est idempotente et ne détruit rien.

## 10. Phasage

| Phase | Contenu | Livrable visible |
|---|---|---|
| 1 | Mode édition en place sur les blocs existants, panneau généré par schéma, rail (déplacer, dupliquer, masquer, supprimer, ajouter), brouillon, publier, révisions | Retoucher une page ne passe plus par un formulaire |
| 2 | Zone libre : conteneur, colonnes (grille de 12), éléments (titre, texte, bouton, image, liste, séparateur) | Composer une page que le thème n'avait pas prévue |
| 3 | Extraction du paquet, starter, doc « nouveau site en une heure » | Un site client branché sans écrire d'éditeur |
| 4 | Confort : glisser-déposer, recadrage d'image, copie de bloc entre pages, aperçu mobile, panneau sombre | Édition à la souris, plus rapide |

Chaque phase est livrable et vérifiable seule. La phase 1 apporte l'essentiel du
bénéfice : elle est prioritaire.

## 11. Risques et parades

| Risque | Parade |
|---|---|
| L'éditeur abîme le design | Jetons seulement, variantes limitées, aucun style libre, tests d'échelle et de CTA en garde-fou |
| Dérive entre schéma et gabarits | Test de contrat : un champ déclaré doit exister dans le rendu, et l'inverse |
| Le paquet devient spécifique à un site | Règle de dépendance entre modules, aucun gabarit dans le paquet, un site de référence (celui-ci) plus le starter |
| Migration cassante en production | Enveloppes posées en un point, test d'égalité du HTML, recette avant production, migration idempotente |
| Explosion du périmètre | Phases, hors-périmètre explicite, phase 1 utile seule |
| Édition en place fragile sur petit écran | Sous 900 px, panneau plein écran, aucune édition en place |

## 12. Critères de succès

- Modifier un titre ou un chapeau sur le site, publier et vérifier en visiteur
  demande moins d'une minute, sans passer par un formulaire.
- Aucun visiteur ne voit jamais un brouillon, y compris en manipulant l'URL.
- Les 172 tests actuels restent verts, plus les tests de contrat et
  d'intégration de l'éditeur.
- Un nouveau site client est opérationnel avec l'éditeur en moins d'une journée,
  sans toucher au code de l'éditeur.
- Le design reste verrouillé : échelle typographique, bandeaux, coins carrés et
  contrastes inchangés après passage par l'éditeur.

## 13. Décisions reportées (à trancher plus tard, hors de cette spec)

- Adresse dédiée `admin.sujeedesign.com` pour l'admin et l'éditeur.
- Publication bloc par bloc plutôt que page par page.
- Multi-utilisateurs et rôles (Sujee plus un client, par exemple).
- Bibliothèque de modèles de pages et de sections à importer.

