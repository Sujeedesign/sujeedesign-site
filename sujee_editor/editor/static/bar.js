/* Barre d'état : ce qui est en brouillon, publier, revenir à une révision. */

import { EditorApiError } from "./api.js";

export function mountBar(context, hooks) {
  const { store, api } = context;
  const root = document.createElement("div");
  root.className = "sjd-bar";
  root.setAttribute("role", "status");
  document.body.appendChild(root);
  let message = "";
  let tone = "info";

  function button(text, handler, primary) {
    const node = document.createElement("button");
    node.type = "button";
    node.textContent = text;
    if (primary) {
      node.dataset.primary = "1";
    }
    node.addEventListener("click", handler);
    return node;
  }

  function publishedLabel() {
    const revisions = store.revisions;
    if (!revisions.length) {
      return "jamais publiée depuis l'éditeur";
    }
    return `publiée le ${String(revisions[0].created_at || "").replace("T", " ").slice(0, 16)}`;
  }

  async function publish() {
    try {
      const payload = await api.publish();
      store.setState({ sections: payload.sections, revisions: payload.revisions });
      context.refresh();
      notice("Publication faite. La page publique est à jour.", "ok");
    } catch (error) {
      handle(error);
    }
  }

  async function restore(revisionId) {
    if (!revisionId) {
      return;
    }
    try {
      const payload = await api.restore(revisionId);
      store.setState(payload);
      context.refresh();
      notice("Révision replacée en brouillon : vérifie puis publie.", "info");
    } catch (error) {
      handle(error);
    }
  }

  async function reloadRevisions() {
    try {
      const payload = await api.revisions();
      store.replaceRevisions(payload.revisions || []);
      render();
    } catch (error) {
      handle(error);
    }
  }

  function handle(error) {
    if (error instanceof EditorApiError) {
      notice(error.message, error.status === 409 ? "error" : "warn");
      if (error.status === 401) {
        context.lock();
      }
    } else {
      notice("Action impossible : réseau indisponible.", "error");
    }
  }

  function notice(text, value) {
    message = text || "";
    tone = value || "info";
    render();
  }

  function render() {
    root.textContent = "";
    const status = document.createElement("p");
    status.className = "sjd-bar__status";
    const pending = store.pendingCount();
    const parts = [pending ? `${pending} modification${pending > 1 ? "s" : ""} en brouillon` : "Aucun brouillon", publishedLabel()];
    if (message) {
      parts.unshift(message);
    }
    status.textContent = parts.join(" · ");
    status.dataset.tone = tone;

    const revisions = document.createElement("select");
    revisions.className = "sjd-bar__select";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Revenir à…";
    revisions.appendChild(empty);
    store.revisions.forEach((revision) => {
      const option = document.createElement("option");
      option.value = String(revision.id);
      option.textContent = `${String(revision.created_at || "").replace("T", " ").slice(0, 16)} · ${revision.note || revision.author || ""}`;
      revisions.appendChild(option);
    });
    revisions.addEventListener("change", () => {
      if (revisions.value) {
        restore(Number(revisions.value));
        revisions.value = "";
      }
    });
    revisions.addEventListener("focus", reloadRevisions);

    const tools = (hooks.tools && hooks.tools()) || [];
    const toolsBox = document.createElement("div");
    toolsBox.className = "sjd-bar__tools";
    tools.forEach((tool) => {
      const node = button(tool.label, tool.onClick, false);
      if (tool.pressed) {
        node.setAttribute("aria-pressed", "true");
      }
      toolsBox.appendChild(node);
    });

    root.append(status, revisions);
    if (toolsBox.childElementCount) {
      root.appendChild(toolsBox);
    }
    const quit = button("Quitter l'édition", () => {
      window.location.href = window.location.pathname;
    });
    quit.dataset.role = "quit";
    root.append(button("Publier", publish, true), quit);
    // La hauteur réelle de la barre sert aux vues plein écran des écrans étroits.
    document.documentElement.style.setProperty(
      "--sjd-bar-h",
      `${Math.round(root.getBoundingClientRect().height)}px`,
    );
  }

  render();
  return { render, notice };
}
