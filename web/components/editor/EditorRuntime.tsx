"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { patchState, setActions } from "./adminbar-state";

/**
 * Runtime d'édition visuelle de la vitrine.
 *
 * Ne s'active que si le repère de session `sjd_edit=1` est présent (posé par
 * l'admin à la connexion) : le composant interroge alors `/api/editor/session`,
 * qui vérifie la vraie session admin côté FastAPI. Sans session, rien ne
 * s'affiche et les `data-field` restent inertes.
 *
 * Édition : cliquez un texte, tapez, Entrée pour enregistrer, Échap pour
 * annuler. Les champs multilignes (titres sur plusieurs lignes, listes)
 * s'éditent dans une carte avec un textarea, une ligne par ligne.
 */

type FieldMeta = { path: string; label: string; type: string; value: unknown };
type Session = {
  ok: boolean;
  user: string;
  csrf: string;
  sections: Section[];
  publish_ready: boolean;
  pending: boolean;
};
type Section = {
  title?: string;
  blocks?: { title?: string; fields?: FieldMeta[] }[];
  fields?: FieldMeta[];
};

const EDIT_COOKIE = "sjd_edit";
const MULTILINE_TYPES = new Set(["long", "lines", "tags", "list"]);
const PAGE_SLUGS = new Set(["services", "realisations", "a-propos", "agents-ia"]);

/** Page éditée d'après l'URL : seules les pages du modèle sont reconnues. */
function currentSlug(): string {
  const first = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return PAGE_SLUGS.has(first) ? first : "home";
}

function hasEditCookie(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${EDIT_COOKIE}=1`));
}

function flatten(sections: Section[]): Map<string, FieldMeta> {
  const map = new Map<string, FieldMeta>();
  for (const section of sections ?? []) {
    const groups = section.blocks?.length
      ? section.blocks.map((b) => b.fields ?? [])
      : [section.fields ?? []];
    for (const fields of groups) {
      for (const field of fields) {
        if (field?.path) map.set(field.path, field);
      }
    }
  }
  return map;
}

function textOf(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  // Les espaces insécables de la typographie française sont conservées : on
  // ne normalise que les espaces ordinaires insérés par le navigateur.
  return (clone.textContent ?? "").replace(/[ \t]{2,}/g, " ").trim();
}

function setLines(el: HTMLElement, value: string) {
  el.innerHTML = "";
  value.split("\n").forEach((line, index) => {
    if (index > 0) el.appendChild(document.createElement("br"));
    el.appendChild(document.createTextNode(line));
  });
}

const CSS = `
/* Le bandeau admin gère le décalage du header ; ici on ne règle que l'édition. */
body.sjd-editing .cookie-banner{ display:none !important; }
body.sjd-editing [data-field]{
  cursor:text;
  outline:1.5px dashed rgba(201,52,15,.55);
  outline-offset:4px;
  border-radius:1px;
  transition:outline-color .12s ease, background-color .12s ease;
}
/* La vitrine désactive les clics sur certains blocs (pointer-events:none
   sur la copie du hero, liens étirés). En édition, on les réactive sur les
   champs eux-mêmes pour que le texte redevienne cliquable. */
body.sjd-editing [data-field], body.sjd-editing [data-field] *{ pointer-events:auto; }
body.sjd-editing [data-field]:hover{ outline-color:#C9340F; background:rgba(201,52,15,.06); }
body.sjd-editing [data-field].sjd-selected{ outline:2px solid #C9340F; background:rgba(201,52,15,.07); }
body.sjd-editing [data-field][contenteditable="true"]{ outline:2px solid #C9340F; background:rgba(255,255,255,.5); }
.sjd-tag{
  position:absolute; z-index:2147483001; transform:translateY(-100%);
  background:#C9340F; color:#fff; font:600 10px/1 "Space Grotesk", system-ui, sans-serif;
  letter-spacing:.09em; text-transform:uppercase; padding:6px 8px; border-radius:3px;
  pointer-events:none; white-space:nowrap;
}
.sjd-pop{
  position:fixed; z-index:2147483002; width:min(520px, calc(100vw - 40px));
  background:#0A0A0B; color:#F4F1E8; border-radius:4px; padding:16px;
  box-shadow:0 24px 60px rgba(0,0,0,.45);
  font:400 13px/1.5 "Space Grotesk", system-ui, sans-serif;
}
.sjd-pop h4{ margin:0 0 4px; font:600 11px/1 "Space Grotesk", system-ui, sans-serif; letter-spacing:.09em; text-transform:uppercase; color:#E8B04A; }
.sjd-pop p{ margin:0 0 10px; font-size:11.5px; opacity:.55; }
.sjd-pop textarea{
  width:100%; min-height:110px; resize:vertical; background:rgba(255,255,255,.06);
  color:inherit; border:1px solid rgba(255,255,255,.22); border-radius:3px; padding:10px;
  font:400 13px/1.55 "Space Grotesk", system-ui, sans-serif;
}
.sjd-pop textarea:focus{ outline:2px solid #C9340F; outline-offset:-1px; }
.sjd-pop .row{ display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
.sjd-pop button{
  font:500 12px/1 "Space Grotesk", system-ui, sans-serif; color:#F4F1E8;
  background:transparent; border:1px solid rgba(255,255,255,.22); border-radius:3px;
  padding:9px 13px; cursor:pointer;
}
.sjd-pop button.primary{ background:#C9340F; border-color:#C9340F; }
.sjd-toast{
  position:fixed; left:50%; bottom:74px; transform:translateX(-50%); z-index:2147483003;
  background:#0A0A0B; color:#F4F1E8; padding:10px 16px; border-radius:3px;
  font:500 12px/1 "Space Grotesk", system-ui, sans-serif; box-shadow:0 12px 30px rgba(0,0,0,.35);
}
.sjd-toast.err{ background:#C9340F; }
`;

export default function EditorRuntime() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  // Modifications non publiées, telles que le serveur les voit : c'est la
  // seule source de vérité pour l'état du bouton Publier.
  const [pending, setPending] = useState(false);
  const [pop, setPop] = useState<{ path: string; label: string; top: number; left: number } | null>(null);
  const [popValue, setPopValue] = useState("");
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const editingRef = useRef<HTMLElement | null>(null);
  const originalRef = useRef<string>("");
  const slugRef = useRef<string>("home");
  // Dernière valeur réellement enregistrée par champ : évite le double POST
  // qu'un Enter suivi d'un blur peut déclencher.
  const savedRef = useRef<Map<string, string>>(new Map());

  const flash = useCallback((text: string, err = false) => {
    setToast({ text, err });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Le HTML servi par la vitrine est figé au build : sans ce report, une valeur
  // enregistrée resterait invisible jusqu'à la publication. On applique donc le
  // document enregistré sur les champs dès l'activation (aperçu du brouillon).
  const applyValues = (data: Session) => {
    for (const field of flatten(data.sections ?? []).values()) {
      const raw = field.value;
      if (raw === null || raw === undefined) continue;
      const text = Array.isArray(raw) ? raw.join("\n") : String(raw);
      const multiline = MULTILINE_TYPES.has(field.type ?? "");
      document.querySelectorAll<HTMLElement>(`[data-field="${field.path}"]`).forEach((el) => {
        if (el.isContentEditable) return;
        if (el.tagName === "UL" || el.tagName === "OL") {
          el.innerHTML = "";
          text.split("\n").map((v) => v.trim()).filter(Boolean).forEach((v) => {
            const li = document.createElement("li");
            li.textContent = v;
            el.appendChild(li);
          });
          return;
        }
        if (multiline) {
          setLines(el, text);
          return;
        }
        el.textContent = text;
      });
      // Titre multiligne rendu ligne par ligne : chaque ligne porte son index.
      if (Array.isArray(raw) && field.type === "lines") {
        raw.forEach((line, index) => {
          const el = document.querySelector<HTMLElement>(`[data-field="${field.path}.${index}"]`);
          if (!el || el.isContentEditable) return;
          el.textContent = String(line);
        });
      }
    }
  };

  // Activation : seulement si le repère de session est présent.
  useEffect(() => {
    if (!hasEditCookie()) return;
    let cancelled = false;
    slugRef.current = currentSlug();
    fetch(`/api/editor/session?page=${encodeURIComponent(slugRef.current)}`, { credentials: "same-origin", headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Session | null) => {
        if (cancelled || !data?.ok) return;
        const withSchema: Session = { ...data, sections: data.sections ?? [] };
        sessionRef.current = withSchema;
        setSession(withSchema);
        setPending(Boolean(data.pending));
        patchState({
          ready: true,
          user: data.user ?? "",
          slug: slugRef.current,
          editing: true,
          pending: Boolean(data.pending),
          publishReady: Boolean(data.publish_ready),
        });
        document.body.classList.add("sjd-editing");
        applyValues(withSchema);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (path: string, value: string): Promise<{ ok: boolean; error?: string }> => {
      const csrf = sessionRef.current?.csrf ?? "";
      try {
        const res = await fetch("/api/editor/champ", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ path, value, csrf, slug: slugRef.current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "Enregistrement refusé" };
        savedRef.current.set(path, value);
        if (typeof data.pending === "boolean") setPending(data.pending);
        if (typeof data.pending === "boolean") patchState({ pending: data.pending });
        return { ok: true };
      } catch {
        return { ok: false, error: "Serveur injoignable" };
      }
    },
    [],
  );

  // Un titre multiligne est déclaré comme une liste (`hero.title`) mais rendu
  // ligne par ligne (`hero.title.0`). On hérite donc des métadonnées du parent
  // pour que chaque ligne reste éditable.
  const fieldMeta = (path: string) => {
    const session = sessionRef.current;
    if (!session) return undefined;
    const map = flatten(session.sections);
    const direct = map.get(path);
    if (direct) return direct;
    const split = path.match(/^(.*)\.(\d+)$/);
    if (!split) return undefined;
    const parentPath = split[1] ?? "";
    const parent = map.get(parentPath);
    if (!parent || parent.type !== "lines") return undefined;
    const parentLabel = parent.label ?? parentPath;
    return { ...parent, path, type: "text", label: `${parentLabel} ${Number(split[2]) + 1}` };
  };

  const stopInline = () => {
    const el = editingRef.current;
    if (!el) return;
    el.removeAttribute("contenteditable");
    el.classList.remove("sjd-selected");
    const tag = el.parentElement?.querySelector(`.sjd-tag[data-for="${el.dataset.field}"]`);
    tag?.remove();
    editingRef.current = null;
  };

  const startInline = (el: HTMLElement, path: string) => {
    editingRef.current = el;
    originalRef.current = textOf(el);
    el.setAttribute("contenteditable", "plaintext-only");
    el.classList.add("sjd-selected");
    el.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const commitInline = async (el: HTMLElement) => {
    const path = el.dataset.field ?? "";
    const value = textOf(el);
    const before = originalRef.current;
    stopInline();
    if (value === before) return;
    if (savedRef.current.get(path) === value) return;
    // Marqué avant l'appel : le blur déclenché par stopInline() relance
    // commitInline pendant que la requête est encore en vol.
    savedRef.current.set(path, value);
    const res = await save(path, value);
    if (!res.ok) {
      savedRef.current.delete(path);
      el.textContent = before;
      flash(res.error ?? "Refusé", true);
    } else {
      flash("Enregistré");
    }
  };

  // Un lien « stretched » (::after plein cadre) capte le clic à la place du
  // texte : on neutralise ponctuellement le lien pour retrouver le champ.
  const resolveField = (event: MouseEvent): HTMLElement | null => {
    const target = event.target as HTMLElement | null;
    const direct = target?.closest("[data-field]") as HTMLElement | null;
    if (direct) return direct;
    const link = target?.closest("a[href]") as HTMLElement | null;
    if (!link) return null;
    const previous = link.style.pointerEvents;
    link.style.pointerEvents = "none";
    const under = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    link.style.pointerEvents = previous;
    return (under?.closest("[data-field]") as HTMLElement | null) ?? null;
  };

  // Interactions globales en mode édition.
  useEffect(() => {
    if (!session) return;

    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement)?.closest("#sjd-adminbar, #sjd-dock, .sjd-pop, .sjd-toast")) return;
      const el = resolveField(event);
      if (!el) {
        if (editingRef.current) void commitInline(editingRef.current);
        // En édition, un clic hors champ ne doit pas faire quitter la page :
        // on neutralise les liens et boutons de la vitrine.
        const action = (event.target as HTMLElement)?.closest("a[href], button, [role='button']");
        if (action) {
          event.preventDefault();
          event.stopPropagation();
          flash("Mode édition : quittez l’édition pour naviguer");
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const path = el.dataset.field ?? "";
      if (editingRef.current && editingRef.current !== el) void commitInline(editingRef.current);
      if (editingRef.current === el) return;

      const meta = fieldMeta(path);
      const multiline = el.dataset.multiline === "1" || MULTILINE_TYPES.has(meta?.type ?? "");
      if (multiline) {
        const rect = el.getBoundingClientRect();
        setPop({
          path,
          label: meta?.label ?? path,
          top: Math.min(rect.bottom + 10, window.innerHeight - 260),
          left: Math.max(16, Math.min(rect.left, window.innerWidth - 540)),
        });
        setPopValue(textOf(el));
        el.classList.add("sjd-selected");
        return;
      }
      startInline(el, path);
    };

    const onKey = (event: KeyboardEvent) => {
      const el = editingRef.current;
      if (!el) return;
      if (event.key === "Escape") {
        event.preventDefault();
        const before = originalRef.current;
        stopInline();
        el.textContent = before;
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void commitInline(el);
      }
    };

    const onBlur = (event: FocusEvent) => {
      const el = editingRef.current;
      if (el && event.target === el) void commitInline(el);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("blur", onBlur, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("blur", onBlur, true);
    };
  }, [session]);

  const closePop = (restore?: HTMLElement | null) => {
    if (pop) {
      document
        .querySelectorAll(`[data-field="${pop.path}"]`)
        .forEach((el) => el.classList.remove("sjd-selected"));
    }
    restore?.classList.remove("sjd-selected");
    setPop(null);
  };

  const savePop = async () => {
    if (!pop) return;
    setBusy(true);
    const res = await save(pop.path, popValue);
    setBusy(false);
    if (!res.ok) {
      flash(res.error ?? "Refusé", true);
      return;
    }
    document.querySelectorAll<HTMLElement>(`[data-field="${pop.path}"]`).forEach((el) => {
      if (el.tagName === "UL" || el.tagName === "OL") {
        el.innerHTML = "";
        popValue.split("\n").map((v) => v.trim()).filter(Boolean).forEach((v) => {
          const li = document.createElement("li");
          li.textContent = v;
          el.appendChild(li);
        });
      } else {
        setLines(el, popValue);
      }
      el.classList.remove("sjd-selected");
    });
    setPop(null);
    flash("Enregistré");
  };

  const publish = async () => {
    if (!sessionRef.current) return;
    setPublishing(true);
    patchState({ publishing: true });
    try {
      const res = await fetch("/api/editor/publier", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csrf: sessionRef.current.csrf, slug: slugRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setPending(Boolean(data.pending ?? false));
        patchState({ pending: Boolean(data.pending ?? false) });
        flash(
          data.mode === "cache"
            ? "Publié : le site se met à jour dans quelques secondes"
            : "Publication lancée, le site se met à jour dans ~1 min",
        );
      } else {
        flash(data.error ?? "Publication impossible", true);
      }
    } catch {
      flash("Serveur injoignable", true);
    } finally {
      setPublishing(false);
      patchState({ publishing: false });
    }
  };

  const quit = () => {
    // Le repère repasse à "0" : la vitrine redevient publique. Le passage par
    // /admin/editer le remet à "1" pour une nouvelle session d'édition.
    document.cookie = `${EDIT_COOKIE}=0; path=/; samesite=lax`;
    document.body.classList.remove("sjd-editing");
    patchState({ editing: false, publishing: false });
    setSession(null);
    // Sortie de l'éditeur = retour dans l'admin, jamais sur la page publique.
    window.location.href = "/admin";
  };

  const modifierPage = () => {
    const first = document.querySelector<HTMLElement>("[data-field]");
    if (!first) {
      flash("Aucun champ éditable sur cette page", true);
      return;
    }
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      first.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }, 350);
  };

  // Une seule barre sur la page : celle du bandeau admin, qui déclenche les
  // actions de l'éditeur. Plus de dock séparé.
  useEffect(() => {
    if (!session) return;
    setActions({ quit, publish });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, pending, publishing]);

  if (!session) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {pop ? (
        <div className="sjd-pop" style={{ top: pop.top, left: pop.left }}>
          <h4>{pop.label}</h4>
          <p>Une ligne par ligne affichée sur la page. Champ : {pop.path}</p>
          <textarea value={popValue} onChange={(e) => setPopValue(e.target.value)} autoFocus />
          <div className="row">
            <button type="button" onClick={() => closePop()}>
              Annuler
            </button>
            <button type="button" className="primary" onClick={savePop} disabled={busy}>
              {busy ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`sjd-toast${toast.err ? " err" : ""}`}>{toast.text}</div> : null}
    </>
  );
}