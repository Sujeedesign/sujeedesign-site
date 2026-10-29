"use client";

import { useEffect, useState } from "react";

const EDIT_COOKIE = "sjd_edit";
const SLUGS = new Set(["services", "realisations", "a-propos", "agents-ia"]);

type State = { user: string; slug: string; pending: boolean; csrf: string } | null;

function currentSlug(): string {
  const first = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return SLUGS.has(first) ? first : "home";
}

function editCookieOn(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${EDIT_COOKIE}=1`));
}

const CSS = `
#sjd-adminbar{position:fixed;top:0;left:0;right:0;height:44px;z-index:2147483003;display:flex;align-items:center;gap:12px;padding:0 16px;background:#0A0A0B;color:#F4F1E8;font:500 12.5px/1 "Space Grotesk",system-ui,sans-serif;box-shadow:0 1px 0 rgba(255,255,255,.08)}
#sjd-adminbar .tag{font:700 10.5px/1 "Space Grotesk",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0A0A0B;background:#E8B04A;padding:4px 6px;border-radius:2px}
#sjd-adminbar .who{opacity:.72}
#sjd-adminbar .who b{font-weight:600;color:#F4F1E8}
#sjd-adminbar .sep{width:1px;height:16px;background:rgba(255,255,255,.2)}
#sjd-adminbar .state{color:#E8B04A;opacity:.9}
#sjd-adminbar .push{margin-left:auto}
#sjd-adminbar a,#sjd-adminbar button{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 11px;border:1px solid rgba(255,255,255,.22);border-radius:3px;background:transparent;color:inherit;font:inherit;text-decoration:none;cursor:pointer;transition:background .15s ease,border-color .15s ease}
#sjd-adminbar a:hover,#sjd-adminbar button:hover{background:rgba(255,255,255,.1)}
#sjd-adminbar button.accent{background:#C9340F;border-color:#C9340F;color:#fff}
#sjd-adminbar button.accent:hover{background:#E03D13;border-color:#E03D13}
body.sjd-adminbar-on{padding-top:44px}
body.sjd-adminbar-on .nav{top:44px}
@media (max-width:760px){
  #sjd-adminbar{font-size:11.5px;gap:8px;padding:0 10px}
  #sjd-adminbar .who,#sjd-adminbar .state,#sjd-adminbar .sep{display:none}
}
`;

export default function AdminBar() {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    if (editCookieOn()) return; // le bandeau de l'éditeur prend le relais
    let cancelled = false;
    const slug = currentSlug();
    fetch(`/api/editor/session?page=${encodeURIComponent(slug)}`, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; user?: string; pending?: boolean; csrf?: string } | null) => {
        if (cancelled || !data?.ok || !data.user) return;
        setState({ user: data.user, slug, pending: Boolean(data.pending), csrf: data.csrf ?? "" });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    document.body.classList.add("sjd-adminbar-on");
    return () => document.body.classList.remove("sjd-adminbar-on");
  }, [state]);

  if (!state) return null;

  const editHref = `/admin/editer?page=${encodeURIComponent(state.slug)}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div id="sjd-adminbar">
        <span className="tag">Admin</span>
        <span className="who">
          Connecté : <b>{state.user}</b>
        </span>
        {state.pending ? (
          <>
            <span className="sep" />
            <span className="state">Modifications non publiées</span>
          </>
        ) : null}
        <span className="push" />
        <button type="button" className="accent" onClick={() => { window.location.href = editHref; }}>
          Modifier la page
        </button>
        <a href="/admin/pages">Pages</a>
        <a href="/admin">Tableau de bord</a>
      </div>
    </>
  );
}
