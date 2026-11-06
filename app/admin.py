"""Back office : tableau de bord, contenu de la vitrine, messages, médias, réglages.

Un seul rôle, une seule base : ce module ne rend aucune page publique. L'aperçu
pointe vers la vitrine Next réellement déployée (iframe), il ne reconstruit plus
un site parallèle.
"""

from __future__ import annotations

import json
import mimetypes
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote, urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from . import catalogue
from . import content as content_store
from . import content_model
from . import repo
from . import security
from . import settings as settings_module
from . import site_assets
from . import tracking
from .agent.store import FIELD_LABELS
from .db import connect, get_meta, set_meta
from .ui import templates

router = APIRouter()

CSRF_PURPOSE = "admin-csrf"
CSRF_TTL = security.SESSION_TTL
MAX_UPLOAD = 15 * 1024 * 1024
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
}
STATUTS = ("nouveau", "en cours", "traite")
CONTENT_SLUG = "home"

# Pages éditables. Les présentations projet ne sont pas ici : elles restent
# gérées par l'admin projet, pas par l'éditeur de texte.
PAGES: tuple[tuple[str, str, str], ...] = (
    ("home", "Accueil", "/"),
    ("services", "Services", "/services"),
    ("realisations", "Réalisations", "/realisations"),
    ("a-propos", "À propos", "/a-propos"),
    ("agents-ia", "Agents IA", "/agents-ia"),
    ("identite-de-marque", "Fiche · Identité de marque", "/services/identite-de-marque"),
    ("direction-artistique", "Fiche · Direction artistique", "/services/direction-artistique"),
    ("site-ecommerce", "Fiche · Site & e-commerce", "/services/site-ecommerce"),
    ("contenu-reseaux", "Fiche · Contenu & réseaux", "/services/contenu-reseaux"),
)
PAGE_LABELS = {slug: label for slug, label, _ in PAGES}
PAGE_PATHS = {slug: path for slug, _, path in PAGES}


def content_page(page: str | None) -> str:
    """Slug de page demandé, ramené sur une page connue (défaut : accueil)."""
    candidate = (page or "").strip()
    return candidate if candidate in PAGE_LABELS else CONTENT_SLUG


def revision_type(slug: str) -> str:
    return "content" if slug == CONTENT_SLUG else f"content:{slug}"


def revision_slug(entity_type: str) -> str:
    if entity_type.startswith("content:"):
        slug = entity_type.split(":", 1)[1]
        return slug if slug in PAGE_LABELS else CONTENT_SLUG
    return CONTENT_SLUG


# Navigation : cinq groupes, un seul niveau. L'ancien onglet « Aperçu » a été
# retiré (il dupliquait le lien « Voir le site ») et le catalogue a désormais sa
# place : les projets et les prestations sont des contenus structurés, pas des
# pages de texte.
NAV_GROUPS: tuple[tuple[str, tuple[tuple[str, str, str], ...]], ...] = (
    ("Pilotage", (("tableau_de_bord", "Tableau de bord", "/admin"),)),
    (
        "Catalogue",
        (
            ("projets", "Projets", "/admin/projets"),
            ("prestations", "Prestations", "/admin/prestations"),
        ),
    ),
    ("Contenu", (("pages", "Pages du site", "/admin/pages"), ("instagram", "Instagram", "/admin/instagram"))),
    (
        "Échanges",
        (
            ("messages", "Messages", "/admin/messages"),
            ("demandes", "Demandes du chat", "/admin/demandes"),
            ("propositions", "Propositions", "/admin/propositions"),
        ),
    ),
    (
        "Système",
        (
            ("medias", "Médias", "/admin/medias"),
            ("medias_site", "Images du site", "/admin/medias/site"),
            ("reglages", "Réglages", "/admin/reglages"),
            ("sauvegarde", "Sauvegarde", "/admin/sauvegarde"),
        ),
    ),
)

# Préfixes qui gardent un onglet actif sur ses sous-pages.
NAV_PREFIXES = {
    "pages": ("/admin/pages", "/admin/contenu"),
    "projets": ("/admin/projets",),
    "prestations": ("/admin/prestations",),
    "medias_site": ("/admin/medias/site",),
}


def nav_groups(active: str, badges: dict[str, int] | None = None) -> list[dict[str, Any]]:
    badges = badges or {}
    groups: list[dict[str, Any]] = []
    index = 0
    for label, items in NAV_GROUPS:
        entries = []
        for key, item_label, href in items:
            index += 1
            prefixes = NAV_PREFIXES.get(key, (href,))
            on = active == href if href == "/admin" else any(active.startswith(p) for p in prefixes)
            entries.append(
                {
                    "key": key,
                    "label": item_label,
                    "href": href,
                    "idx": str(index).zfill(2),
                    "on": on,
                    "cnt": badges.get(key) or 0,
                }
            )
        groups.append({"label": label, "items": entries})
    return groups



# ------------------------------------------------------------------- session


def db_path(request: Request) -> Path:
    return Path(request.app.state.db_path)


def get_conn(request: Request) -> sqlite3.Connection:
    return connect(db_path(request))


def current_user(request: Request) -> str | None:
    token = request.cookies.get(security.SESSION_COOKIE, "")
    return "admin" if token and security.verify_session(token) else None


def csrf_token(request: Request | None = None) -> str:
    """Jeton anti-CSRF, lié à la session admin en cours.

    Sans session (page de connexion), le jeton est signé avec la clé publique :
    il ne peut rien déclencher, `check_csrf` exige une session.
    """
    key = _csrf_key(request) if request is not None else None
    return security.make_token(CSRF_PURPOSE, CSRF_TTL, key=key)


def _csrf_key(request: Request) -> str | None:
    session = request.cookies.get(security.SESSION_COOKIE, "")
    if session and security.verify_session(session):
        # On lie le jeton au nonce de la session, pas au jeton complet : une
        # session renouvelée garde ses formulaires ouverts valides.
        nonce = security.session_nonce(session)
        return "sess:" + nonce if nonce else None
    return None


def _allowed_hosts(request: Request) -> set[str]:
    """Hôtes légitimes pour la vérification d'origine.

    Derrière le proxy Next (rewrites /admin et /api/editor), le `Host` reçu
    n'est pas forcément celui du navigateur : on accepte donc aussi
    `X-Forwarded-Host` et le domaine public configuré.
    """
    hosts: set[str] = set()
    for header in ("host", "x-forwarded-host"):
        raw = request.headers.get(header, "")
        if raw:
            hosts.add(raw.split(",")[0].strip().lower())
    public = urlparse(settings_module.public_base_url()).netloc.lower()
    if public:
        hosts.add(public)
    return {h for h in hosts if h}


def check_csrf(request: Request, token: str) -> None:
    # Le jeton ne remplace pas la session : sans cookie admin valide, aucune
    # écriture, même avec un jeton parfaitement signé.
    if current_user(request) is None:
        raise HTTPException(status_code=403, detail="session requise")
    supplied_origin = request.headers.get("origin") or request.headers.get("referer") or ""
    if supplied_origin:
        hosts = _allowed_hosts(request)
        origin_host = urlparse(supplied_origin).netloc.lower()
        if hosts and origin_host and origin_host not in hosts:
            raise HTTPException(status_code=403, detail="origine refusée")
    if not security.verify_token(CSRF_PURPOSE, token or "", CSRF_TTL, key=_csrf_key(request)):
        raise HTTPException(status_code=403, detail="formulaire expiré, recharge la page")


def require_admin(request: Request) -> str:
    user = current_user(request)
    if user is None:
        raise HTTPException(status_code=303, headers={"location": "/admin/connexion"})
    return user


def back(url: str, message: str = "", kind: str = "ok") -> RedirectResponse:
    if message:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}flash={quote(message)}&kind={kind}"
    return RedirectResponse(url, status_code=303)


def _nav_badges(request: Request) -> dict[str, int]:
    """Compteurs de la barre latérale : brouillons et messages non traités."""
    try:
        conn = get_conn(request)
    except Exception:  # base pas encore ouverte (page de connexion)
        return {}
    try:
        nouveaux = repo.message_counts(conn).get("nouveau", 0)
        brouillons = conn.execute("SELECT COUNT(*) AS n FROM projets WHERE statut = 'brouillon'").fetchone()["n"]
        demandes = _demandes_a_traiter(conn)
    except sqlite3.Error:
        return {}
    finally:
        conn.close()
    return {"messages": int(nouveaux or 0), "projets": int(brouillons or 0), "demandes": demandes}


def _demandes_a_traiter(conn: sqlite3.Connection) -> int:
    """Nombre de demandes du chat encore à traiter (table absente = 0)."""
    try:
        row = conn.execute("SELECT COUNT(*) AS n FROM agent_leads WHERE status = 'qualifie'").fetchone()
    except sqlite3.Error:
        return 0
    return int(row["n"] or 0)


def render(request: Request, template: str, **context: Any) -> HTMLResponse:
    user = current_user(request)
    active = request.url.path
    base = {
        "request": request,
        "user": user,
        "nav": nav_groups(active, _nav_badges(request)),
        "active": active,
        "csrf": csrf_token(request),
        "flash": request.query_params.get("flash", ""),
        "flash_kind": request.query_params.get("kind", "ok"),
        "public_url": settings_module.public_base_url(),
        "now": datetime.now(),
    }
    base.update(context)
    return templates.TemplateResponse(request, template, base)


# ----------------------------------------------------------------- connexion


@router.get("/admin/connexion", response_class=HTMLResponse)
def connexion_form(request: Request) -> Response:
    if current_user(request):
        return RedirectResponse("/admin", status_code=303)
    return render(request, "connexion.html", error="")


@router.post("/admin/connexion")
def connexion(request: Request, password: str = Form("")) -> Response:
    limiter = _limiter(request)
    ip = security.client_ip_from(
        request.client.host if request.client else "",
        request.headers.get("x-forwarded-for", ""),
    )
    if not limiter.allow("login:" + security.hash_ip(ip), limit=8, window=900):
        return render(request, "connexion.html", error="Trop de tentatives. Réessaie dans 15 minutes.")
    try:
        valid = security.check_password(password)
    except RuntimeError:
        return render(request, "connexion.html", error="ADMIN_PASSWORD n'est pas configuré sur le serveur.")
    if not valid:
        return render(request, "connexion.html", error="Mot de passe incorrect.")
    response = RedirectResponse("/admin", status_code=303)
    response.set_cookie(
        security.SESSION_COOKIE,
        security.make_session(),
        max_age=security.SESSION_TTL,
        httponly=True,
        samesite="lax",
        secure=settings_module.cookie_secure(),
        path="/",
    )
    # Repère lisible par le JavaScript de la vitrine : une session admin existe,
    # le runtime peut donc interroger /api/editor/session. HttpOnly reste actif
    # pour le cookie de session lui-même. Ce drapeau n'active PAS l'édition :
    # consulter le site en étant connecté reste un simple aperçu.
    response.set_cookie(
        security.UI_MARKER_COOKIE,
        "1",
        max_age=security.SESSION_TTL,
        httponly=False,
        samesite="lax",
        secure=settings_module.cookie_secure(),
        path="/",
    )
    limiter.reset()
    return response


@router.post("/admin/deconnexion")
def deconnexion(request: Request, csrf: str = Form("")) -> Response:
    # Déconnecter ne doit jamais échouer sur une session déjà expirée : on tente
    # la vérification CSRF, mais on efface les cookies dans tous les cas.
    try:
        check_csrf(request, csrf)
    except HTTPException:
        pass
    response = RedirectResponse("/admin/connexion", status_code=303)
    response.delete_cookie(security.SESSION_COOKIE, path="/")
    response.delete_cookie(security.UI_MARKER_COOKIE, path="/")
    response.delete_cookie(security.EDIT_MARKER_COOKIE, path="/")
    return response


def _limiter(request: Request) -> security.RateLimiter:
    limiter = getattr(request.app.state, "admin_limiter", None)
    if limiter is None:
        limiter = security.RateLimiter()
        request.app.state.admin_limiter = limiter
    return limiter


# ---------------------------------------------------------- tableau de bord


@router.get("/admin", response_class=HTMLResponse)
def tableau_de_bord(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        counts = repo.message_counts(conn)
        medias = repo.table_counts(conn)["medias"]
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        publication = content_store.last_publication(conn)
        recents = repo.list_messages(conn, limit=5)
        revisions = repo.list_revisions(conn, limit=4)
        propositions_cartes = _propositions_cartes(conn)
    finally:
        conn.close()
    return render(
        request,
        "tableau_de_bord.html",
        counts=counts,
        medias=medias,
        doc=doc,
        publication=publication,
        recents=recents,
        revisions=revisions,
        propositions=propositions_cartes,
        publish_ready=content_store.publish_ready(),
    )


# --------------------------------------------------------------------- pages


@router.get("/admin/pages", response_class=HTMLResponse)
def pages(request: Request, user: str = Depends(require_admin)) -> Response:
    """Liste des pages éditables, façon CRM : une carte par page."""
    conn = get_conn(request)
    try:
        rows = []
        for slug, label, path in PAGES:
            doc = content_store.load_doc(conn, slug)
            rows.append(
                {
                    "slug": slug,
                    "label": label,
                    "path": path,
                    "updated_at": doc["updated_at"],
                    "custom": doc["custom"],
                    "field_count": len(content_model.fields_for(slug)),
                }
            )
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    return render(
        request,
        "pages.html",
        pages=rows,
        publication=publication,
        publish_ready=content_store.publish_ready(),
    )


@router.get("/admin/editer")
def editer_en_place(request: Request, page: str = "", user: str = Depends(require_admin)) -> Response:
    """Ouvre la vraie page du site en mode édition.

    Le repère `sjd_edit` est une demande ponctuelle : la vitrine l'ouvre puis
    l'efface aussitôt. Une visite ultérieure du site reste donc en simple
    consultation, même si l'onglet a été fermé en pleine édition.
    """
    slug = content_page(page)
    target = PAGE_PATHS[slug]
    response = RedirectResponse(target, status_code=303)
    response.set_cookie(
        security.EDIT_MARKER_COOKIE,
        "1",
        max_age=security.SESSION_TTL,
        httponly=False,
        samesite="lax",
        secure=settings_module.cookie_secure(),
        path="/",
    )
    return response


@router.get("/admin/contenu", response_class=HTMLResponse)
def contenu(request: Request, page: str = "", user: str = Depends(require_admin)) -> Response:
    """Édition par formulaire d'une page : le secours de l'édition en place."""
    slug = content_page(page)
    conn = get_conn(request)
    try:
        doc = content_store.load_doc(conn, slug)
        publication = content_store.last_publication(conn)
        revisions = repo.list_revisions(conn, entity_type=revision_type(slug), limit=8)
    finally:
        conn.close()
    sections = content_model.form_sections(slug, doc["data"])
    return render(
        request,
        "contenu.html",
        doc=doc,
        slug=slug,
        page_label=PAGE_LABELS[slug],
        page_path=PAGE_PATHS[slug],
        sections=sections,
        publication=publication,
        revisions=revisions,
        publish_ready=content_store.publish_ready(),
        error="",
    )


@router.post("/admin/contenu")
async def contenu_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    slug = content_page(str(form.get("page") or ""))
    back_to = "/admin/contenu?page=" + slug
    publish = str(form.get("action") or "save") == "publier"
    conn = get_conn(request)
    try:
        current = content_store.load_doc(conn, slug)
        try:
            doc = content_model.from_form(slug, form, current["data"])
        except content_model.ContentError as exc:
            # On réaffiche la saisie refusée pour ne pas la perdre, sans l'enregistrer.
            try:
                draft = content_model.from_form(slug, form, current["data"], validate_doc=False)
            except content_model.ContentError:
                draft = current["data"]
            sections = content_model.form_sections(slug, draft)
            publication = content_store.last_publication(conn)
            revisions = repo.list_revisions(conn, entity_type=revision_type(slug), limit=8)
            return render(
                request,
                "contenu.html",
                doc=current,
                slug=slug,
                page_label=PAGE_LABELS[slug],
                page_path=PAGE_PATHS[slug],
                sections=sections,
                publication=publication,
                revisions=revisions,
                publish_ready=content_store.publish_ready(),
                error=f"Contenu refusé, rien n'a été enregistré : {exc}",
            )
        repo.save_revision(conn, revision_type(slug), 0, current["data"], "avant enregistrement", user)
        content_store.save_doc(conn, slug, doc, author=user)
    finally:
        conn.close()
    if not publish:
        return back(back_to, f"{PAGE_LABELS[slug]} enregistré. La vitrine sera mise à jour à la prochaine publication.")
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, CONTENT_SLUG)
    finally:
        conn.close()
    if not result.get("ok"):
        return back(
            back_to,
            "Contenu enregistré, mais la publication a échoué : " + str(result.get("error", "")),
            "error",
        )
    return back(back_to, "Contenu enregistré, publication lancée.")


@router.post("/admin/contenu/publier")
def contenu_publier(request: Request, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        result = content_store.request_publish(conn, CONTENT_SLUG)
    finally:
        conn.close()
    if not result.get("ok"):
        return back("/admin/pages", "Publication impossible : " + str(result.get("error", "")), "error")
    return back("/admin/pages", "Publication lancée. La vitrine redéploie dans une minute environ.")


@router.post("/admin/contenu/restaurer/{revision_id}")
def contenu_restaurer(request: Request, revision_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = conn.execute(
            "SELECT * FROM revisions WHERE id = ? AND entity_type LIKE 'content%'", (revision_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="révision introuvable")
        slug = revision_slug(str(row["entity_type"]))
        snapshot = repo.revision_snapshot(row)
        current = content_store.load_doc(conn, slug)
        repo.save_revision(conn, revision_type(slug), 0, current["data"], "avant restauration", "admin")
        content_store.save_doc(conn, slug, snapshot, author="admin")
    finally:
        conn.close()
    return back(
        "/admin/contenu?page=" + slug,
        "Version restaurée. Publie pour l'envoyer sur la vitrine.",
    )


# ------------------------------------------------------------------ messages


@router.get("/admin/messages", response_class=HTMLResponse)
def messages(request: Request, statut: str = "", user: str = Depends(require_admin)) -> Response:
    filtre = statut if statut in STATUTS else None
    conn = get_conn(request)
    try:
        rows = repo.list_messages(conn, status=filtre)
        counts = repo.message_counts(conn)
    finally:
        conn.close()
    return render(request, "messages.html", messages=rows, counts=counts, statut=filtre or "")


@router.post("/admin/messages/{message_id}/statut")
def message_statut(
    request: Request, message_id: int, statut: str = Form(""), note: str = Form(""), csrf: str = Form("")
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        values: dict[str, Any] = {}
        if statut in STATUTS:
            values["status"] = statut
        if note.strip():
            values["note"] = note.strip()[:2000]
        repo.update_message(conn, message_id, values)
        conn.commit()
    finally:
        conn.close()
    return back("/admin/messages", "Message mis à jour.")


@router.post("/admin/messages/{message_id}/supprimer")
def message_supprimer(request: Request, message_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        repo.delete_message(conn, message_id)
        conn.commit()
    finally:
        conn.close()
    return back("/admin/messages", "Message supprimé.")


# ------------------------------------------------------------ demandes du chat


@router.get("/admin/demandes", response_class=HTMLResponse)
def demandes(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        leads = [
            dict(row)
            for row in conn.execute(
                "SELECT * FROM agent_leads ORDER BY id DESC LIMIT 200"
            ).fetchall()
        ]
        bookings = [
            dict(row)
            for row in conn.execute(
                "SELECT * FROM agent_bookings ORDER BY slot_start ASC LIMIT 200"
            ).fetchall()
        ]
    except sqlite3.Error:
        leads, bookings = [], []
    finally:
        conn.close()
    for lead in leads:
        try:
            lead["fields"] = json.loads(lead.get("fields") or "{}")
        except ValueError:
            lead["fields"] = {}
        lead["slot_label"] = _slot_label(lead.get("slot_start") or "")
        lead["status_label"] = STATUS_LABELS.get(str(lead.get("status")), str(lead.get("status") or ""))
        lead["status_class"] = STATUS_CLASSES.get(str(lead.get("status")), "archivee")
    return render(request, "demandes.html", leads=leads, bookings=bookings, labels=FIELD_LABELS)


# ------------------------------------------------------- propositions clients


PROPOSITIONS = {
    "n2e": "N2E Échafaudages",
    "dimension-nouvelle": "Dimension Nouvelle",
    "polyresine": "Polyrésine",
    "sei": "SEI",
    "prunelle": "À la Prunelle de mes ongle'S",
}


def _paris_datetime(value: str) -> str:
    """Horodatage SQLite (UTC) -> « 5 nov. à 14:32 » en heure de Paris."""
    try:
        moment = datetime.fromisoformat(str(value)).replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return ""
    from zoneinfo import ZoneInfo

    local = moment.astimezone(ZoneInfo("Europe/Paris"))
    return f"{local.day} {local.strftime('%b').rstrip('.')} à {local:%H:%M}"


def _duree(secondes: float | None) -> str:
    total = int(secondes or 0)
    if total <= 0:
        return "—"
    if total < 60:
        return f"{total} s"
    minutes, reste = divmod(total, 60)
    return f"{minutes} min {reste:02d}" if reste else f"{minutes} min"


def _propositions_cartes(conn: sqlite3.Connection) -> list[dict[str, Any]]:
    """Une carte par proposition : trafic agrégé, prêt pour l'admin."""
    try:
        tracking.purger_vues(conn)
    except sqlite3.Error:
        pass
    try:
        rows = [
            dict(row)
            for row in conn.execute(
                "SELECT slug, COUNT(*) AS vues,"
                " COUNT(DISTINCT NULLIF(ip_hash, '')) AS visiteurs,"
                " MAX(created_at) AS derniere,"
                " AVG(NULLIF(secondes, 0)) AS duree"
                " FROM proposition_vues GROUP BY slug"
            ).fetchall()
        ]
    except sqlite3.Error:
        rows = []
    stats = {row["slug"]: row for row in rows}
    cartes = []
    for slug, nom in PROPOSITIONS.items():
        row = stats.get(slug, {})
        cartes.append(
            {
                "slug": slug,
                "nom": nom,
                "url": f"/propositions/{slug}/",
                "vues": int(row.get("vues") or 0),
                "visiteurs": int(row.get("visiteurs") or 0),
                "derniere": _paris_datetime(row.get("derniere") or ""),
                "duree": _duree(row.get("duree")),
            }
        )
    return cartes



@router.get("/admin/propositions", response_class=HTMLResponse)
def propositions(request: Request, user: str = Depends(require_admin)) -> Response:
    """Consultation des trois propositions envoyées aux clients."""
    conn = get_conn(request)
    try:
        # Purge quotidienne : la page admin est le point de passage sûr même
        # quand le conteneur tourne plusieurs jours sans redémarrage.
        cartes = _propositions_cartes(conn)
        recent = [
            dict(row)
            for row in conn.execute(
                "SELECT id, slug, secondes, referer, ua, created_at"
                " FROM proposition_vues ORDER BY id DESC LIMIT 80"
            ).fetchall()
        ]
    except sqlite3.Error:
        cartes, recent = [], []
    finally:
        conn.close()

    for item in recent:
        item["nom"] = PROPOSITIONS.get(str(item.get("slug") or ""), item.get("slug") or "")
        item["quand"] = _paris_datetime(item.get("created_at") or "")
        item["temps"] = _duree(item.get("secondes"))
        item["navigateur"] = _navigateur(item.get("ua") or "")
    return render(request, "propositions.html", cartes=cartes, recent=recent)


@router.post("/admin/propositions/{vue_id}/supprimer")
def proposition_supprimer(request: Request, vue_id: int, csrf: str = Form("")) -> Response:
    """Retire une consultation : sert aussi à effacer ses propres tests."""
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        conn.execute("DELETE FROM proposition_vues WHERE id = ?", (vue_id,))
        conn.commit()
    finally:
        conn.close()
    return back("/admin/propositions", "Consultation supprimée.")


def _navigateur(ua: str) -> str:
    ua = ua.lower()
    if "iphone" in ua or "ipad" in ua:
        return "iPhone/iPad"
    if "android" in ua:
        return "Android"
    if "edg/" in ua:
        return "Edge"
    if "firefox" in ua:
        return "Firefox"
    if "chrome" in ua:
        return "Chrome"
    if "safari" in ua:
        return "Safari"
    return "Autre"


STATUS_CLASSES = {
    "qualifie": "nouveau",
    "qualifiee": "nouveau",
    "convertie": "traite",
    "archivee": "archivee",
}


STATUS_LABELS = {
    "qualifie": "à traiter",
    "qualifiee": "à traiter",
    "convertie": "convertie",
    "archivee": "archivée",
}


def _slot_label(value: str) -> str:
    """Créneau ISO -> « lundi 2 novembre à 09:00 » (heure de Paris)."""
    try:
        start = datetime.fromisoformat(value)
    except ValueError:
        return ""
    from zoneinfo import ZoneInfo

    if start.tzinfo is None:
        start = start.replace(tzinfo=ZoneInfo("UTC"))
    local = start.astimezone(ZoneInfo("Europe/Paris"))
    jours = ("lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche")
    mois = (
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
    )
    return f"{jours[local.weekday()]} {local.day} {mois[local.month - 1]} à {local:%H:%M}"


@router.post("/admin/demandes/{lead_id}/supprimer")
def demande_supprimer(request: Request, lead_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = conn.execute("SELECT slot_start, event_id FROM agent_leads WHERE id = ?", (lead_id,)).fetchone()
        if row is not None and row["slot_start"]:
            conn.execute("DELETE FROM agent_bookings WHERE slot_start = ?", (row["slot_start"],))
        conn.execute("DELETE FROM agent_leads WHERE id = ?", (lead_id,))
        conn.commit()
    finally:
        conn.close()
    return back("/admin/demandes", "Demande supprimée.")


# -------------------------------------------------------------------- médias


@router.get("/admin/medias", response_class=HTMLResponse)
def medias(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        rows = repo.list_medias(conn)
    finally:
        conn.close()
    return render(request, "medias.html", medias=rows)


@router.post("/admin/medias")
async def medias_upload(
    request: Request,
    fichier: UploadFile = File(...),
    alt: str = Form(""),
    caption: str = Form(""),
    credit: str = Form(""),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    mime = (fichier.content_type or "").lower()
    extension = ALLOWED_TYPES.get(mime)
    if extension is None:
        guessed = mimetypes.guess_type(fichier.filename or "")[0] or ""
        extension = ALLOWED_TYPES.get(guessed)
    if extension is None:
        return back("/admin/medias", "Format refusé. Utilise JPG, PNG, WebP, AVIF, GIF ou PDF.", "error")

    payload = await fichier.read()
    if not payload:
        return back("/admin/medias", "Fichier vide.", "error")
    if len(payload) > MAX_UPLOAD:
        return back("/admin/medias", "Fichier trop lourd (15 Mo maximum).", "error")
    if not security.sniff_matches(payload, extension):
        return back("/admin/medias", "Le contenu du fichier ne correspond pas au format annoncé.", "error")

    folder = Path(request.app.state.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    filename = security.random_filename(extension)
    (folder / filename).write_bytes(payload)

    width = height = 0
    try:  # optionnel : les dimensions ne bloquent jamais l'import
        from PIL import Image  # type: ignore

        with Image.open(folder / filename) as image:
            width, height = image.size
    except Exception:
        pass

    conn = get_conn(request)
    try:
        repo.register_media(
            conn,
            {
                "filename": filename,
                "original_filename": (fichier.filename or "")[:200],
                "path": f"/medias/{filename}",
                "alt": alt.strip()[:300],
                "caption": caption.strip()[:300],
                "credit": credit.strip()[:200],
                "mime": mime or "",
                "width": width,
                "height": height,
                "size": len(payload),
            },
        )
        conn.commit()
    finally:
        conn.close()
    return back("/admin/medias", "Média importé.")


@router.post("/admin/medias/{media_id}/supprimer")
def media_supprimer(request: Request, media_id: int, csrf: str = Form("")) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = repo.delete_media(conn, media_id)
        conn.commit()
    finally:
        conn.close()
    if row is not None:
        target = Path(request.app.state.media_dir) / row["filename"]
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass
    return back("/admin/medias", "Média supprimé.")


# ------------------------------------------------- images réellement servies par le site


@router.get("/admin/medias/site", response_class=HTMLResponse)
def medias_site(request: Request, scan: int = 0, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        inv = site_assets.inventory(conn, force=bool(scan)) if scan else None
        if inv is None and site_assets.cached() is not None:
            inv = site_assets.inventory(conn)
    finally:
        conn.close()
    return render(request, "medias_site.html", inv=inv)


@router.post("/admin/medias/site")
def medias_site_reindex(request: Request, csrf: str = Form("")) -> Response:
    """Réintègre dans la médiathèque les fichiers présents mais sans fiche."""
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        added = site_assets.reindex_orphans(conn)
    finally:
        conn.close()
    if added:
        return back("/admin/medias/site", f"{added} fichier(s) réintégré(s) dans la médiathèque.")
    return back("/admin/medias/site", "Rien à réintégrer : tout est déjà en base.")


# ------------------------------------------------------------------ reglages


@router.get("/admin/reglages", response_class=HTMLResponse)
def reglages(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        values = settings_module.all_settings(conn)
        publication = content_store.last_publication(conn)
    finally:
        conn.close()
    return render(
        request,
        "reglages.html",
        values=values,
        publication=publication,
        publish_ready=content_store.publish_ready(),
        fields=(
            ("site_name", "Nom du site", "text"),
            ("tagline", "Slogan / accroche", "text"),
            ("email", "Email de contact", "email"),
            ("phone", "Téléphone", "tel"),
            ("site_url", "URL du site public", "url"),
            ("linkedin", "LinkedIn", "url"),
            ("behance", "Behance", "url"),
            ("city", "Ville", "text"),
        ),
    )


@router.post("/admin/reglages")
async def reglages_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        for key in settings_module.DEFAULT_SETTINGS:
            if f"f_{key}" in form:
                settings_module.set_value(conn, key, str(form.get(f"f_{key}") or "").strip())
        settings_module.set_value(conn, "site_url", str(form.get("f_site_url") or "").strip())
        conn.commit()
    finally:
        conn.close()
    return back("/admin/reglages", "Réglages enregistrés.")


# ------------------------------------------------------------------ projets


def _rows(form: Any, prefix: str, names: tuple[str, ...]) -> list[tuple[str, ...]]:
    columns = [list(form.getlist(f"{prefix}_{name}")) for name in names]
    total = max((len(col) for col in columns), default=0)
    rows = []
    for index in range(total):
        rows.append(tuple((col[index] if index < len(col) else "") for col in columns))
    return rows


@router.get("/admin/projets", response_class=HTMLResponse)
def projets(request: Request, statut: str = "", user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        items = catalogue.list_projets(conn)
    finally:
        conn.close()
    if statut in catalogue.STATUTS:
        items = [item for item in items if item["statut"] == statut]
    return render(
        request,
        "projets.html",
        projets=items,
        statut=statut,
        counts=_catalogue_counts(request, "projets"),
    )


def _catalogue_counts(request: Request, table: str) -> dict[str, int]:
    conn = get_conn(request)
    try:
        rows = conn.execute(f"SELECT statut, COUNT(*) AS n FROM {table} GROUP BY statut").fetchall()
    finally:
        conn.close()
    counts = {"tous": 0, "brouillon": 0, "publie": 0}
    for row in rows:
        counts[str(row["statut"])] = int(row["n"])
        counts["tous"] += int(row["n"])
    return counts


def _media_picker(request: Request, limit: int = 400) -> list[sqlite3.Row]:
    """Visuels de la médiathèque proposés dans les sélecteurs de l'éditeur."""
    conn = get_conn(request)
    try:
        return [m for m in repo.list_medias(conn, limit) if str(m["mime"] or "").startswith("image/")]
    finally:
        conn.close()


@router.get("/admin/projets/nouveau", response_class=HTMLResponse)
def projet_nouveau(request: Request, user: str = Depends(require_admin)) -> Response:
    return render(
        request,
        "projet_form.html",
        projet={"id": None, "slug": "", "nom": "", "client": "", "annee": "", "ville": "",
                "pitch": "", "scope": "", "duree": "", "ton": "paper", "statut": "brouillon",
                "disciplines": [], "tags": [], "images": [], "sections": [], "results": [],
                "cover": None, "coverPortrait": None},
        medias=_media_picker(request),
        counts=_catalogue_counts(request, "projets"),
        mode="new",
    )


@router.get("/admin/projets/{projet_id}", response_class=HTMLResponse)
def projet_editer(request: Request, projet_id: int, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        projet = catalogue.get_projet(conn, projet_id)
        revisions = [
            row
            for row in conn.execute(
                "SELECT id, note, author, created_at FROM revisions"
                " WHERE entity_type = 'projet' AND entity_id = ? ORDER BY id DESC LIMIT 8",
                (projet_id,),
            ).fetchall()
        ]
    finally:
        conn.close()
    if projet is None:
        raise HTTPException(status_code=404, detail="projet introuvable")
    return render(
        request,
        "projet_form.html",
        projet=projet,
        revisions=revisions,
        medias=_media_picker(request),
        counts=_catalogue_counts(request, "projets"),
        mode="edit",
    )


def _repeater_envoye(form: Mapping[str, Any], prefix: str) -> bool:
    """Un répéteur est considéré envoyé si le formulaire le signale.

    Le gabarit pose un champ caché `<prefix>s_present`. Les clients plus anciens
    (tests, scripts) n'envoient que les champs `image_*`, `section_*` ou
    `result_*` : on les détecte aussi. Sans aucune trace, la clé est laissée de
    côté et l'enregistrement conserve les lignes existantes.
    """
    if form.get(f"{prefix}s_present"):
        return True
    return any(key == f"{prefix}_" or key.startswith(f"{prefix}_") for key in form)


def _snapshot_projet(conn: Any, projet_id: int) -> dict[str, Any] | None:
    """Photo complète d'une fiche avant écrasement (restauration possible)."""
    row = conn.execute("SELECT * FROM projets WHERE id = ?", (projet_id,)).fetchone()
    return dict(row) if row else None


@router.post("/admin/projets")
async def projet_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    payload: dict[str, Any] = dict(form)
    # Les répéteurs ne sont envoyés que si la section est présente dans le
    # formulaire : une écriture partielle ne doit jamais vider images,
    # sections ou résultats déjà enregistrés.
    if _repeater_envoye(form, "image"):
        payload["images"] = _rows(form, "image", ("src", "alt", "w", "h"))
    if _repeater_envoye(form, "section"):
        payload["sections"] = _rows(form, "section", ("k", "label", "title", "body", "bullets"))
    if _repeater_envoye(form, "result"):
        payload["results"] = _rows(form, "result", ("value", "label"))
    raw_id = str(form.get("id") or "").strip()
    conn = get_conn(request)
    try:
        if raw_id.isdigit():
            snapshot = _snapshot_projet(conn, int(raw_id))
            if snapshot:
                repo.save_revision(conn, "projet", int(raw_id), snapshot, "avant enregistrement", user)
        projet_id = catalogue.save_projet(conn, payload, int(raw_id) if raw_id.isdigit() else None)
    except ValueError as exc:
        target = f"/admin/projets/{raw_id}" if raw_id.isdigit() else "/admin/projets/nouveau"
        return back(target, str(exc), "error")
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back(f"/admin/projets/{projet_id}", "Projet enregistré.")


@router.post("/admin/projets/{projet_id}/statut")
async def projet_statut(request: Request, projet_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        catalogue.set_projet_statut(conn, projet_id, str(form.get("statut") or ""))
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/projets", "Statut mis à jour.")


@router.post("/admin/projets/{projet_id}/position")
async def projet_position(request: Request, projet_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    direction = -1 if str(form.get("dir") or "") == "up" else 1
    conn = get_conn(request)
    try:
        catalogue.move_projet(conn, projet_id, direction)
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/projets")


@router.post("/admin/projets/{projet_id}/supprimer")
async def projet_supprimer(request: Request, projet_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        catalogue.delete_projet(conn, projet_id)
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/projets", "Projet supprimé.")


@router.post("/admin/projets/{projet_id}/restaurer/{revision_id}")
def projet_restaurer(
    request: Request, projet_id: int, revision_id: int, user: str = Depends(require_admin)
) -> Response:
    conn = get_conn(request)
    try:
        row = conn.execute(
            "SELECT * FROM revisions WHERE id = ? AND entity_type = 'projet' AND entity_id = ?",
            (revision_id, projet_id),
        ).fetchone()
        if row is None:
            return back(f"/admin/projets/{projet_id}", "Version introuvable.", "error")
        snapshot = repo.revision_snapshot(row)
        if not isinstance(snapshot, dict) or not snapshot:
            return back(f"/admin/projets/{projet_id}", "Version illisible.", "error")
        current = _snapshot_projet(conn, projet_id)
        if current:
            repo.save_revision(conn, "projet", projet_id, current, "avant restauration", user)
        columns = [key for key in snapshot if key != "id"]
        if not columns:
            return back(f"/admin/projets/{projet_id}", "Version vide.", "error")
        conn.execute(
            f"UPDATE projets SET {', '.join(f'{key} = ?' for key in columns)}, updated_at = datetime('now') WHERE id = ?",
            (*[snapshot[key] for key in columns], projet_id),
        )
        conn.commit()
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back(f"/admin/projets/{projet_id}", "Version restaurée.")


# -------------------------------------------------------------- prestations


@router.get("/admin/prestations", response_class=HTMLResponse)
def prestations(request: Request, statut: str = "", user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        items = catalogue.list_prestations(conn)
    finally:
        conn.close()
    if statut in catalogue.STATUTS:
        items = [item for item in items if item["statut"] == statut]
    return render(request, "prestations.html", prestations=items, statut=statut,
                  counts=_catalogue_counts(request, "prestations"))


@router.get("/admin/prestations/nouveau", response_class=HTMLResponse)
def prestation_nouvelle(request: Request, user: str = Depends(require_admin)) -> Response:
    return render(
        request,
        "prestation_form.html",
        prestation={"id": None, "slug": "", "nom": "", "accroche": "", "description": "",
                    "prix": "", "duree": "", "statut": "brouillon", "livrables": []},
        counts=_catalogue_counts(request, "prestations"),
        mode="new",
    )


@router.get("/admin/prestations/{prestation_id}", response_class=HTMLResponse)
def prestation_editer(request: Request, prestation_id: int, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        prestation = catalogue.get_prestation(conn, prestation_id)
    finally:
        conn.close()
    if prestation is None:
        raise HTTPException(status_code=404, detail="prestation introuvable")
    return render(request, "prestation_form.html", prestation=prestation,
                  counts=_catalogue_counts(request, "prestations"), mode="edit")


@router.post("/admin/prestations")
async def prestation_save(request: Request, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    payload: dict[str, Any] = dict(form)
    raw_id = str(form.get("id") or "").strip()
    conn = get_conn(request)
    try:
        prestation_id = catalogue.save_prestation(conn, payload, int(raw_id) if raw_id.isdigit() else None)
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back(f"/admin/prestations/{prestation_id}", "Prestation enregistrée.")


@router.post("/admin/prestations/{prestation_id}/statut")
async def prestation_statut(request: Request, prestation_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        catalogue.set_prestation_statut(conn, prestation_id, str(form.get("statut") or ""))
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/prestations", "Statut mis à jour.")


@router.post("/admin/prestations/{prestation_id}/position")
async def prestation_position(request: Request, prestation_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    direction = -1 if str(form.get("dir") or "") == "up" else 1
    conn = get_conn(request)
    try:
        catalogue.move_prestation(conn, prestation_id, direction)
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/prestations")


@router.post("/admin/prestations/{prestation_id}/supprimer")
async def prestation_supprimer(request: Request, prestation_id: int, user: str = Depends(require_admin)) -> Response:
    form = await request.form()
    check_csrf(request, str(form.get("csrf") or ""))
    conn = get_conn(request)
    try:
        catalogue.delete_prestation(conn, prestation_id)
    finally:
        conn.close()
    content_store.notify_site("catalogue")
    return back("/admin/prestations", "Prestation supprimée.")


@router.get("/admin/catalogue/export.json")
def catalogue_export(request: Request, user: str = Depends(require_admin)) -> Response:
    """Catalogue publié au format attendu par la vitrine Next."""
    conn = get_conn(request)
    try:
        body = catalogue.export_json(conn)
    finally:
        conn.close()
    filename = f"sujee-catalogue-{datetime.now():%Y-%m-%d}.json"
    return Response(
        body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------------------------------------------------------ sauvegarde


@router.get("/admin/sauvegarde", response_class=HTMLResponse)
def sauvegarde(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        counts = repo.table_counts(conn)
    finally:
        conn.close()
    path = db_path(request)
    size = path.stat().st_size if path.exists() else 0
    return render(request, "sauvegarde.html", counts=counts, size=size, path=str(path))


@router.get("/admin/sauvegarde/export.json")
def sauvegarde_export(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        doc = content_store.load_doc(conn, CONTENT_SLUG)
        rows = [dict(row) for row in repo.list_messages(conn)]
        values = settings_module.all_settings(conn)
    finally:
        conn.close()
    payload = {
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "content": doc["data"],
        "messages": rows,
        "settings": values,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    filename = f"sujee-design-{datetime.now():%Y-%m-%d}.json"
    return Response(
        body,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/admin/etat")
def etat(request: Request, user: str = Depends(require_admin)) -> JSONResponse:
    conn = get_conn(request)
    try:
        return JSONResponse(
            {
                "ok": True,
                "messages": repo.message_counts(conn),
                "counts": repo.table_counts(conn),
                "publication": content_store.last_publication(conn),
            }
        )
    finally:
        conn.close()


# ------------------------------------------------------------------ instagram
#
# Grille « Sur Instagram » de l'accueil, 100 % manuelle : Sujee importe l'image
# ou la vidéo, écrit la légende et colle le lien du post. Rien n'est récupéré
# automatiquement depuis Instagram.

INSTAGRAM_SLOTS = repo.INSTAGRAM_SLOTS
INSTAGRAM_VIDEO_MAX = 60 * 1024 * 1024
INSTAGRAM_PROFILE = "https://www.instagram.com/sujeedesign.ai/"
INSTAGRAM_DEFAULTS = {
    "instagram_title": "Sur Instagram",
    "instagram_intro": (
        "Identités, coulisses et images générées : le fil @sujeedesign.ai "
        "se regarde aussi ici."
    ),
}
INSTAGRAM_IMAGE_TYPES = {
    key: value
    for key, value in ALLOWED_TYPES.items()
    if key.startswith("image/") and key != "image/gif"
}


def _instagram_settings(conn: sqlite3.Connection) -> dict[str, str]:
    return {
        "title": get_meta(conn, "instagram_title", INSTAGRAM_DEFAULTS["instagram_title"]),
        "intro": get_meta(conn, "instagram_intro", INSTAGRAM_DEFAULTS["instagram_intro"]),
        "profile": INSTAGRAM_PROFILE,
    }


def _instagram_poster(folder: Path, filename: str) -> str:
    """Extrait une vignette JPEG de la vidéo quand ffmpeg est disponible."""
    if shutil.which("ffmpeg") is None:
        return ""
    poster_name = f"ig-{Path(filename).stem}.jpg"
    try:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-ss",
                "0.5",
                "-i",
                str(folder / filename),
                "-frames:v",
                "1",
                "-vf",
                "scale=720:-2",
                str(folder / poster_name),
            ],
            check=True,
            timeout=30,
        )
    except (subprocess.SubprocessError, OSError):
        return ""
    return f"/medias/{poster_name}" if (folder / poster_name).exists() else ""


def backfill_instagram_posters(conn, media_dir: Path) -> int:
    """Génère les vignettes manquantes des vidéos Instagram déjà en base.

    Appelé au démarrage : les vidéos importées avant l'ajout de ffmpeg dans
    l'image n'ont pas de poster, la grille afficherait des rectangles noirs.
    Renvoie le nombre de vignettes créées.
    """
    if shutil.which("ffmpeg") is None:
        return 0
    folder = Path(media_dir)
    created = 0
    try:
        rows = list(
            conn.execute(
                "SELECT id, src FROM instagram_posts WHERE kind = 'video' AND (poster IS NULL OR poster = '')"
            )
        )
    except sqlite3.Error:
        return 0
    for row in rows:
        filename = Path(str(row["src"] or "")).name
        if not filename or not (folder / filename).exists():
            continue
        poster = _instagram_poster(folder, filename)
        if not poster:
            continue
        conn.execute("UPDATE instagram_posts SET poster = ? WHERE id = ?", (poster, int(row["id"])))
        created += 1
    if created:
        conn.commit()
    return created


async def _instagram_store_file(
    request: Request, fichier: UploadFile
) -> tuple[dict[str, str], str]:
    """Valide et enregistre le fichier importé. Renvoie (valeurs, message d'erreur)."""
    payload = await fichier.read()
    if not payload:
        return {}, "Fichier vide."

    mime = (fichier.content_type or "").lower()
    extension = INSTAGRAM_IMAGE_TYPES.get(mime)
    if extension is None:
        extension = INSTAGRAM_IMAGE_TYPES.get(mimetypes.guess_type(fichier.filename or "")[0] or "")

    kind = "image"
    if extension is None:
        video = security.sniff_video(payload)
        if not video:
            return {}, "Format refusé. Utilise JPG, PNG, WebP, AVIF, MP4 (H.264) ou WebM."
        extension = ".mp4" if video == "video/mp4" else ".webm"
        kind = "video"

    limit = INSTAGRAM_VIDEO_MAX if kind == "video" else MAX_UPLOAD
    if len(payload) > limit:
        return {}, (
            "Vidéo trop lourde (60 Mo maximum)." if kind == "video" else "Image trop lourde (15 Mo maximum)."
        )
    if kind == "image" and not security.sniff_matches(payload, extension):
        return {}, "Le contenu du fichier ne correspond pas au format annoncé."

    folder = Path(request.app.state.media_dir)
    folder.mkdir(parents=True, exist_ok=True)
    filename = security.random_filename(extension)
    (folder / filename).write_bytes(payload)

    values = {"kind": kind, "src": f"/medias/{filename}", "poster": ""}
    if kind == "video":
        values["poster"] = _instagram_poster(folder, filename)
    return values, ""


@router.get("/admin/instagram", response_class=HTMLResponse)
def instagram_page(request: Request, user: str = Depends(require_admin)) -> Response:
    conn = get_conn(request)
    try:
        posts = repo.list_instagram_posts(conn)
        values = _instagram_settings(conn)
    finally:
        conn.close()
    return render(
        request,
        "instagram.html",
        posts=posts,
        values=values,
        slots=INSTAGRAM_SLOTS,
    )


@router.post("/admin/instagram/reglages")
def instagram_reglages(
    request: Request,
    titre: str = Form(""),
    intro: str = Form(""),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        set_meta(conn, "instagram_title", titre.strip()[:120] or INSTAGRAM_DEFAULTS["instagram_title"])
        set_meta(conn, "instagram_intro", intro.strip()[:400] or INSTAGRAM_DEFAULTS["instagram_intro"])
        conn.commit()
    finally:
        conn.close()
    content_store.notify_site("instagram")
    return back("/admin/instagram", "Textes de la section enregistrés.")


@router.post("/admin/instagram/ajouter")
async def instagram_ajouter(
    request: Request,
    fichier: UploadFile | None = File(None),
    legende: str = Form(""),
    permalien: str = Form(""),
    alt: str = Form(""),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    if fichier is None or not fichier.filename:
        return back("/admin/instagram", "Choisis une image ou une vidéo.", "error")

    values, error = await _instagram_store_file(request, fichier)
    if error:
        return back("/admin/instagram", error, "error")

    values.update(
        caption=legende.strip()[:600],
        permalink=_safe_instagram_url(permalien),
        alt=alt.strip()[:300] or legende.strip()[:300],
    )
    conn = get_conn(request)
    try:
        post_id = repo.add_instagram_post(conn, values)
        conn.commit()
    finally:
        conn.close()
    if post_id is None:
        return back(
            "/admin/instagram",
            "Les cinq places sont déjà prises. Supprime un post pour en ajouter un autre.",
            "error",
        )
    content_store.notify_site("instagram")
    return back("/admin/instagram", "Post ajouté à la grille.")


@router.post("/admin/instagram/{post_id}/modifier")
async def instagram_modifier(
    request: Request,
    post_id: int,
    fichier: UploadFile | None = File(None),
    legende: str = Form(""),
    permalien: str = Form(""),
    alt: str = Form(""),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = repo.get_instagram_post(conn, post_id)
    finally:
        conn.close()
    if row is None:
        return back("/admin/instagram", "Post introuvable.", "error")

    values = {
        "kind": row["kind"],
        "src": row["src"],
        "poster": row["poster"],
        "caption": legende.strip()[:600],
        "permalink": _safe_instagram_url(permalien),
        "alt": alt.strip()[:300] or legende.strip()[:300],
    }
    if fichier is not None and fichier.filename:
        stored, error = await _instagram_store_file(request, fichier)
        if error:
            return back("/admin/instagram", error, "error")
        values.update(stored)

    conn = get_conn(request)
    try:
        repo.update_instagram_post(conn, post_id, values)
        conn.commit()
    finally:
        conn.close()
    content_store.notify_site("instagram")
    return back("/admin/instagram", "Post mis à jour.")


@router.post("/admin/instagram/{post_id}/deplacer")
def instagram_deplacer(
    request: Request,
    post_id: int,
    direction: str = Form("up"),
    csrf: str = Form(""),
    user: str = Depends(require_admin),
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        moved = repo.move_instagram_post(conn, post_id, direction)
        conn.commit()
    finally:
        conn.close()
    content_store.notify_site("instagram")
    return back("/admin/instagram", "Ordre mis à jour." if moved else "Déplacement impossible.", "ok" if moved else "error")


@router.post("/admin/instagram/{post_id}/supprimer")
def instagram_supprimer(
    request: Request, post_id: int, csrf: str = Form(""), user: str = Depends(require_admin)
) -> Response:
    check_csrf(request, csrf)
    conn = get_conn(request)
    try:
        row = repo.delete_instagram_post(conn, post_id)
        conn.commit()
    finally:
        conn.close()
    if row is not None:
        folder = Path(request.app.state.media_dir)
        for key in ("src", "poster"):
            value = str(row[key] or "")
            if value.startswith("/medias/"):
                try:
                    (folder / value[len("/medias/") :]).unlink(missing_ok=True)
                except OSError:
                    pass
    content_store.notify_site("instagram")
    return back("/admin/instagram", "Post retiré de la grille.")


def _safe_instagram_url(value: str) -> str:
    """N'accepte qu'un lien http(s) pertinent, sinon vide."""
    candidate = value.strip()[:400]
    if not candidate:
        return ""
    if not candidate.startswith(("http://", "https://")):
        return ""
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""
    return candidate
