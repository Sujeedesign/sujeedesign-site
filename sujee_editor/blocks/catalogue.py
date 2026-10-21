"""Registre des types de blocs livrés avec l'éditeur (20 types du thème Sujee)."""

from __future__ import annotations

from .types import Block, Field, Kind

TEXT = Kind.TEXT
TEXTAREA = Kind.TEXTAREA
RICH = Kind.RICH
RICH_LINE = Kind.RICH_LINE
LINES = Kind.LINES
ITEMS = Kind.ITEMS
IMAGES = Kind.IMAGES
IMAGE = Kind.IMAGE
BOOL = Kind.BOOL
NUMBER = Kind.NUMBER
CHOICE = Kind.CHOICE
COLOR = Kind.COLOR
CTAS = Kind.CTAS

CTA_STYLE = ("pill", "pill--filled", "text-link")
SECTION_BACKGROUND_CHOICES = ("default", "paper", "obsidian", "accent", "gradient", "custom")
SECTION_BACKGROUND = Field(
    "section_background", CHOICE, "Arrière-plan", choices=SECTION_BACKGROUND_CHOICES, default="default", inplace=False
)
SECTION_BACKGROUND_COLOR = Field(
    "section_background_color", COLOR, "Couleur personnalisée", default="#f2f2f4", inplace=False
)

CTA_ITEM = Field(
    "ctas",
    CTAS,
    "Boutons",
    max_items=3,
    fields=(
        Field("label", TEXT, "Libellé", max_length=60),
        Field("href", TEXT, "Lien", max_length=300),
        Field("style", CHOICE, "Style", choices=CTA_STYLE),
    ),
)

HEADING_LINES = Field("heading_lines", LINES, "Titre (une ligne par élément)")
KICKER = Field("kicker", TEXT, "Sur-titre", max_length=60)
TITLE = Field("title", RICH_LINE, "Titre", max_length=200)
LABEL = Field("label", TEXT, "Libellé", max_length=80)
ALT = Field("alt", TEXT, "Texte alternatif", max_length=160)
CAPTION = Field("caption", TEXT, "Légende", max_length=200)


def _blocks() -> dict[str, Block]:
    catalogue: dict[str, Block] = {}

    def add(name: str, label: str, fields: tuple[Field, ...], variants: dict[str, str] | None = None) -> None:
        if name != "zone-libre":
            fields = (*fields, SECTION_BACKGROUND, SECTION_BACKGROUND_COLOR)
        catalogue[name] = Block(
            name=name,
            label=label,
            fields=fields,
            template=f"sections/{name.replace('-', '_')}.html",
            variants=dict(variants or {}),
        )

    add(
        "hero",
        "Bandeau d'ouverture",
        (
            KICKER,
            TITLE,
            Field("intro", TEXTAREA, "Introduction", max_length=320),
            Field("meta", LINES, "Étiquettes"),
            Field("rotator", LINES, "Mots du titre rotatif"),
            Field("cover", IMAGE, "Image de couverture", inplace=False),
            Field("cover_alt", TEXT, "Texte alternatif de la couverture", max_length=160, inplace=False),
            Field("image", IMAGE, "Visuel du projet (photo)", inplace=False),
            Field("image_alt", TEXT, "Texte alternatif du visuel du projet", max_length=160, inplace=False),
            Field("image_width", NUMBER, "Largeur du visuel (px)"),
            Field("image_height", NUMBER, "Hauteur du visuel (px)"),
            Field(
                "back_label",
                TEXT,
                "Libellé du retour",
                max_length=40,
                default="Toutes les réalisations",
                inplace=False,
            ),
            Field("back_href", TEXT, "Lien du retour", max_length=300, inplace=False),
            Field("dense", BOOL, "Espacements resserrés"),
            Field("wide_title", BOOL, "Titre de page ample"),
            CTA_ITEM,
            Field("shader", BOOL, "Fond animé"),
        ),
        {
            "accueil": "Accueil (titre centré + fond animé)",
            "page": "Page interne (sur-titre, puis méta)",
            "simple": "Page simple (libellé, titre, intro)",
            "projet": "Couverture de réalisation",
        },
    )
    add(
        "manifeste",
        "Manifeste",
        (
            LABEL,
            HEADING_LINES,
            Field("text", TEXTAREA, "Texte", max_length=600),
        ),
    )
    add(
        "realisations-grid",
        "Grille de réalisations",
        (
            LABEL,
            HEADING_LINES,
            Field("slugs", LINES, "Réalisations (slugs, une par ligne)"),
            Field("limit", NUMBER, "Nombre maximum"),
            Field("all_label", TEXT, "Libellé du lien vers la liste", max_length=80),
        ),
        {"auto": "Automatique (les réalisations publiées)", "manuel": "Sélection manuelle"},
    )
    add("marquee", "Bandeau défilant", (Field("items", LINES, "Mots"),))
    add(
        "services-list",
        "Liste des services",
        (
            LABEL,
            TITLE,
            Field("slugs", LINES, "Services (slugs, un par ligne)"),
        ),
        {"auto": "Automatique (services publiés)", "manuel": "Sélection manuelle"},
    )
    add(
        "chapter",
        "Chapitre éditorial",
        (
            Field("kicker", TEXT, "Sur-titre (ex. 01 · Résumé)", max_length=60),
            Field("title", TEXT, "Titre", max_length=200),
            Field("body", RICH, "Texte"),
            Field("list", LINES, "Liste à puces", inplace=False),
            Field("dark", BOOL, "Fond sombre"),
        ),
    )
    add(
        "texte-riche",
        "Bloc de texte",
        (
            LABEL,
            Field("title", TEXT, "Titre", max_length=200),
            Field("body", RICH, "Texte"),
        ),
        {"1": "Une colonne", "2": "Deux colonnes"},
    )
    add(
        "galerie",
        "Galerie d'images",
        (
            LABEL,
            Field(
                "images",
                IMAGES,
                "Images",
                inplace=False,
                fields=(
                    Field("src", IMAGE, "Fichier"),
                    ALT,
                    CAPTION,
                ),
            ),
            Field("columns", NUMBER, "Colonnes"),
        ),
    )
    add(
        "image-pleine-largeur",
        "Image pleine largeur",
        (
            Field("src", IMAGE, "Fichier"),
            Field("alt", TEXT, "Texte alternatif", max_length=160, inplace=False),
            CAPTION,
        ),
    )
    add(
        "chiffres-cles",
        "Chiffres clés",
        (
            LABEL,
            Field("title", TEXT, "Titre", max_length=200),
            Field(
                "items",
                ITEMS,
                "Chiffres",
                inplace=False,
                fields=(
                    Field("value", TEXT, "Valeur", max_length=20),
                    Field("label", TEXT, "Légende", max_length=80),
                ),
            ),
        ),
    )
    add(
        "process",
        "Étapes du process",
        (
            LABEL,
            Field("title", TEXT, "Titre", max_length=200),
            Field(
                "steps",
                ITEMS,
                "Étapes",
                inplace=False,
                fields=(
                    Field("title", TEXT, "Titre", max_length=120),
                    Field("text", TEXTAREA, "Texte", max_length=400),
                ),
            ),
        ),
    )
    add(
        "citation",
        "Citation",
        (
            Field("quote", TEXTAREA, "Citation", max_length=600),
            Field("author", TEXT, "Auteur", max_length=80),
            Field("role", TEXT, "Fonction", max_length=80),
        ),
    )
    add(
        "faq",
        "Questions fréquentes",
        (
            LABEL,
            Field("title", TEXT, "Titre", max_length=200),
            Field(
                "items",
                ITEMS,
                "Questions",
                inplace=False,
                fields=(
                    Field("q", TEXT, "Question", max_length=200),
                    Field("a", TEXTAREA, "Réponse", max_length=800),
                ),
            ),
        ),
    )
    add(
        "logos-clients",
        "Logos clients",
        (
            LABEL,
            Field(
                "logos",
                IMAGES,
                "Logos",
                inplace=False,
                fields=(
                    Field("src", IMAGE, "Fichier"),
                    ALT,
                ),
            ),
        ),
    )
    add(
        "cta-final",
        "Appel à l'action final",
        (
            KICKER,
            TITLE,
            Field("title_lines", LINES, "Titre découpé (une ligne par élément)"),
            Field("intro", TEXTAREA, "Texte", max_length=320),
            CTA_ITEM,
            Field("shader", BOOL, "Fond animé"),
        ),
        {"interne": "Interne (sur-titre, titre, boutons)", "accueil": "Accueil (section sombre id=contact)"},
    )
    add(
        "formulaire-contact",
        "Formulaire de contact",
        (
            LABEL,
            Field("title", TEXT, "Titre", max_length=200),
            Field("intro", TEXTAREA, "Introduction", max_length=320),
            Field(
                "aside_title",
                TEXT,
                "Titre de la colonne d'infos",
                max_length=80,
                default="Infos pratiques",
                inplace=False,
            ),
            Field(
                "columns",
                ITEMS,
                "Colonnes de texte à droite",
                inplace=False,
                fields=(
                    Field("title", TEXT, "Titre", max_length=120),
                    Field("body", RICH, "Texte"),
                ),
            ),
        ),
    )
    add(
        "bloc-liens",
        "Bloc de liens (même rubrique)",
        (
            LABEL,
            Field("slugs", LINES, "Slugs (une par ligne)"),
            Field("exclude_current", BOOL, "Exclure la page courante"),
        ),
        {"services": "Services", "realisations": "Réalisations", "manuel": "Manuel"},
    )
    add(
        "etude-de-cas",
        "Étude de cas",
        (
            Field(
                "blocks",
                ITEMS,
                "Blocs",
                inplace=False,
                fields=(
                    Field("kind", CHOICE, "Type", choices=("texte", "liste", "meta")),
                    Field("title", TEXT, "Titre", max_length=120),
                    Field("body", RICH, "Texte"),
                    Field("items", LINES, "Éléments"),
                    Field("meta", LINES, "Paires clé/valeur (clé|valeur)"),
                ),
            ),
        ),
    )
    add(
        "banniere",
        "Bannière visuelle",
        (
            Field("src", IMAGE, "Fichier SVG ou image", inplace=False),
            Field("alt", TEXT, "Description pour les lecteurs d'écran", max_length=160, inplace=False),
            Field("svg", RICH, "SVG collé (HTML)", inplace=False),
        ),
    )
    add(
        "zone-libre",
        "Section à composer",
        (
            Field("background", CHOICE, "Arrière-plan", choices=("none", "paper", "obsidian", "accent", "gradient", "custom", "image"), default="none"),
            SECTION_BACKGROUND_COLOR,
            Field("background_image", IMAGE, "Image de fond", inplace=False, default=""),
            Field("width", CHOICE, "Largeur", choices=("container", "full"), default="container"),
            Field("spacing", CHOICE, "Espacement vertical", choices=("compact", "normal", "generous"), default="normal"),
            Field(
                "columns",
                ITEMS,
                "Colonnes",
                max_items=3,
                default=[
                    {"span": "6", "align": "left", "elements": []},
                    {"span": "6", "align": "left", "elements": []},
                ],
                fields=(
                    Field("span", CHOICE, "Largeur de colonne", choices=("2", "3", "4", "5", "6", "7", "8", "9", "10", "12"), default="6"),
                    Field("align", CHOICE, "Alignement", choices=("left", "center", "right"), default="left"),
                    Field(
                        "elements",
                        ITEMS,
                        "Éléments",
                        max_items=8,
                        fields=(
                            Field("type", CHOICE, "Type", choices=("heading", "text", "button", "image", "list", "divider"), default="heading"),
                            Field("text", RICH, "Texte", max_length=4000),
                            Field("level", CHOICE, "Niveau du titre", choices=("h2", "h3", "h4"), default="h2"),
                            Field("label", TEXT, "Libellé du bouton", max_length=100),
                            Field("href", TEXT, "Lien du bouton", max_length=300),
                            Field("role", CHOICE, "Style du bouton", choices=("principal", "secondaire", "lien"), default="principal"),
                            Field("src", IMAGE, "Image", inplace=False),
                            Field("alt", TEXT, "Texte alternatif", max_length=160, inplace=False),
                            Field("items", LINES, "Éléments de la liste"),
                        ),
                    ),
                ),
            ),
        ),
    )
    return catalogue


DEFAULT_BLOCKS: dict[str, Block] = _blocks()


def get_block(name: str) -> Block | None:
    return DEFAULT_BLOCKS.get(name)


__all__ = ["DEFAULT_BLOCKS", "get_block", "Block", "Field", "Kind"]
