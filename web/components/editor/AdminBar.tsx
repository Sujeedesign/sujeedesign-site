"use client";

import { useEffect, useState } from "react";

import {
  clearCookie,
  demanderEdition,
  demanderPublication,
  demanderSortie,
  getState,
  patchState,
  readCookie,
  subscribe,
} from "./adminbar-state";

/**
 * Bandeau admin unique de la vitrine, affiché au-dessus du header.
 *
 * Deux visages :
 *  - consultation : l'admin connecté voit qui il est, un accès au tableau de
 *    bord et le bouton « Modifier la page » ; le site reste strictement en
 *    lecture. Être connecté ne déclenche plus l'édition ;
 *  - édition : une seule barre, avec « Publier » et « Quitter l'édition ».
 *    Quitter ramène à la consultation sur la même page.
 */

type SessionProbe = {
  ok?: boolean;
  user?: string;
  pending?: boolean;
  publish_ready?: boolean;
};

/** Marqueur posé à la connexion admin : évite un appel API pour les visiteurs. */
function hasAdminMarker(): boolean {
  return readCookie("sjd_admin_ui") === "1" || readCookie("sjd_edit") === "1";
}

function pageSlug(): string {
  const first = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return ["services", "realisations", "a-propos", "agents-ia"].includes(first) ? first : "home";
}

const CSS = `
#sjd-adminbar{
  position:fixed; top:0; left:0; right:0; z-index:2147483000;
  display:flex; align-items:center; gap:10px;
  height:38px; padding:0 14px;
  background:#0A0A0B; color:#F4F1E8;
  font:500 11.5px/1 "Space Grotesk", system-ui, sans-serif;
  letter-spacing:.02em;
  border-bottom:1px solid rgba(255,255,255,.12);
}
#sjd-adminbar .dot{ width:6px; height:6px; border-radius:50%; background:#3ecf8e; flex:none; }
#sjd-adminbar.mode-edit .dot{ background:#C9340F; box-shadow:0 0 0 3px rgba(201,52,15,.22); }
#sjd-adminbar .tag{
  font-weight:600; font-size:9.5px; letter-spacing:.12em; text-transform:uppercase;
  color:#E8B04A; padding:3px 6px; border:1px solid rgba(232,176,74,.45); border-radius:2px;
}
#sjd-adminbar .who{ opacity:.62; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:28ch; }
#sjd-adminbar .state{ opacity:.62; }
#sjd-adminbar.mode-edit .state{ color:#F4F1E8; opacity:1; }
#sjd-adminbar .hint{ opacity:.42; font-size:10.5px; }
#sjd-adminbar .push{ margin-left:auto; }
#sjd-adminbar .pending{
  display:inline-flex; align-items:center; gap:6px; color:#E8B04A;
  font-size:10.5px; letter-spacing:.02em;
}
#sjd-adminbar .pending::before{ content:""; width:5px; height:5px; border-radius:50%; background:#E8B04A; }
#sjd-adminbar button, #sjd-adminbar a.btn{
  font:500 11.5px/1 "Space Grotesk", system-ui, sans-serif; color:#F4F1E8;
  background:transparent; border:1px solid rgba(255,255,255,.2); border-radius:3px;
  padding:8px 12px; cursor:pointer; text-decoration:none; white-space:nowrap;
  transition:background-color .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
}
#sjd-adminbar button:hover:not(:disabled), #sjd-adminbar a.btn:hover{ background:rgba(255,255,255,.1); }
#sjd-adminbar button.primary{ background:#C9340F; border-color:#C9340F; color:#fff; }
#sjd-adminbar button.primary:hover:not(:disabled){ background:#e0440f; }
#sjd-adminbar button:disabled{ opacity:.32; cursor:not-allowed; }
#sjd-adminbar button.ghost{ border-color:transparent; opacity:.7; }
#sjd-adminbar button.ghost:hover{ opacity:1; background:rgba(255,255,255,.08); }
#sjd-adminbar .sep{ width:1px; height:16px; background:rgba(255,255,255,.14); }
/* Bandeau présent : le header est en position fixe, il faut donc le décaler
   explicitement, puis décaler le flux de la page de la même hauteur. */
body.sjd-adminbar-on{ padding-top:var(--sjd-admin-h, 38px); }
body.sjd-adminbar-on .nav{ top:var(--sjd-admin-h, 38px); }
@media (max-width:900px){
  #sjd-adminbar{ height:auto; min-height:38px; flex-wrap:wrap; padding:7px 10px; gap:8px; }
  #sjd-adminbar .who, #sjd-adminbar .hint, #sjd-adminbar .state{ display:none; }
}
`;

export default function AdminBar() {
  const [bar, setBar] = useState(getState());
  const [mounted, setMounted] = useState(false);

  useEffect(() => subscribe(() => setBar(getState())), []);

  // Sonde de session : uniquement si le marqueur admin est présent, pour ne pas
  // appeler l'API depuis chaque visite anonyme.
  useEffect(() => {
    setMounted(true);
    if (!hasAdminMarker()) return;
    const slug = pageSlug();
    let alive = true;
    fetch(`/api/editor/session?page=${encodeURIComponent(slug)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SessionProbe | null) => {
        if (!alive) return;
        if (!data?.ok) {
          // Session expirée : on efface le marqueur pour ne plus sonder.
          clearCookie("sjd_admin_ui");
          return;
        }
        patchState({
          ready: true,
          user: data.user ?? "",
          slug,
          pending: Boolean(data.pending),
          publishReady: Boolean(data.publish_ready),
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // La hauteur réelle du bandeau sert de marge sur mobile.
  useEffect(() => {
    document.body.classList.toggle("sjd-adminbar-on", bar.ready);
    if (!bar.ready) return;
    const el = document.getElementById("sjd-adminbar");
    if (el) document.body.style.setProperty("--sjd-admin-h", `${el.offsetHeight}px`);
  }, [bar.ready]);

  if (!mounted || !bar.ready) return null;

  const editing = bar.editing;
  const canPublish = bar.pending && bar.publishReady && !bar.publishing;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="sjd-adminbar" className={editing ? "mode-edit" : ""} data-state={editing ? "edition" : "consultation"}>
        <span className="dot" aria-hidden />
        <span className="tag">Admin</span>
        {bar.user ? <span className="who">{bar.user}</span> : null}
        <span className="sep" aria-hidden />

        {editing ? (
          <>
            <span className="state">Édition en place</span>
            <span className="hint">Cliquez un texte · Entrée pour enregistrer · Échap pour annuler</span>
          </>
        ) : (
          <span className="state">Consultation</span>
        )}

        <span className="push" />

        {bar.pending ? (
          <span className="pending" title="Des modifications ne sont pas encore visibles par les visiteurs">
            Non publié
          </span>
        ) : null}

        {editing ? (
          <>
            <button
              type="button"
              className="primary"
              onClick={demanderPublication}
              disabled={!canPublish}
              title={
                bar.pending
                  ? "Publier les modifications sur le site en ligne"
                  : "Aucune modification à publier"
              }
            >
              {bar.publishing ? "Publication…" : "Publier"}
            </button>
            <button type="button" className="ghost" onClick={demanderSortie}>
              Quitter l’édition
            </button>
          </>
        ) : (
          <>
            <a className="btn" href="/admin">
              Tableau de bord
            </a>
            <button type="button" className="primary" onClick={demanderEdition}>
              Modifier la page
            </button>
          </>
        )}
      </div>
    </>
  );
}
