/* Canevas : sélection d'un bloc, édition en place, marquage des blocs modifiés.

Le canevas ne modifie jamais le HTML du site : il lit les nœuds marqués par le
gabarit (data-field) et écrit la valeur en brouillon côté serveur. */

import { EditorApiError } from "./api.js";

const SINGLE_LINE_KINDS = ["text", "html-line"];

export function mountCanvas(context, hooks) {
  const { store, api } = context;
  const root = document.getElementById("main-content") || document.body;
  let editing = null;
  let busy = false;

  function wrappers() {
    return Array.from(document.querySelectorAll("[data-block-id]"));
  }

  function kindOf(section, fieldName) {
    const block = store.block(section.type);
    const field = block && (block.fields || []).find((item) => item.name === fieldName);
    return field ? field.kind : "text";
  }

  function markSelection() {
    wrappers().forEach((node) => {
      node.classList.toggle("is-selected", Number(node.dataset.blockId) === Number(context.selected));
    });
  }

  function syncDirty() {
    wrappers().forEach((node) => {
      const section = store.section(node.dataset.blockId);
      const revised = Boolean(section && section.revised);
      node.dataset.blockRevised = revised ? "1" : "0";
      node.classList.toggle("is-dirty", revised);
    });
  }

  function render() {
    markSelection();
    syncDirty();
  }

  function editable() {
    return window.innerWidth >= 900 && !context.locked;
  }

  function cancelEdit(restore) {
    if (!editing) {
      return;
    }
    const { node, before } = editing;
    node.textContent = before;
    node.removeAttribute("contenteditable");
    node.classList.remove("is-editing-field");
    editing = null;
    if (restore) {
      hooks.select(null);
    }
  }

  async function commit() {
    if (!editing) {
      return;
    }
    const { node, field, sectionId, before } = editing;
    const kind = kindOf(store.section(sectionId) || { type: "" }, field);
    const raw = SINGLE_LINE_KINDS.includes(kind) ? node.textContent : node.innerHTML;
    const value = SINGLE_LINE_KINDS.includes(kind) ? String(raw || "").trim() : String(raw || "");
    editing = null;
    node.removeAttribute("contenteditable");
    node.classList.remove("is-editing-field");
    if (value === before.trim() || value === before) {
      node.textContent = before;
      return;
    }
    const section = store.section(sectionId);
    if (!section) {
      node.textContent = before;
      return;
    }
    busy = true;
    try {
      const payload = await api.field(sectionId, field, value, section.draft_version);
      store.applySection(payload.section);
      hooks.select(sectionId);
      context.refresh();
    } catch (error) {
      node.textContent = before;
      if (error instanceof EditorApiError) {
        context.notice(error.message, error.status === 409 ? "error" : "warn");
        if (error.status === 409) {
          await context.reload();
        }
      } else {
        context.notice("Écriture impossible : réseau indisponible.", "error");
      }
    } finally {
      busy = false;
    }
  }

  function beginEdit(node) {
    if (busy || !editable()) {
      if (!editable()) {
        context.notice("Sur petit écran, modifie ce champ depuis le panneau.", "info");
      }
      return;
    }
    const field = node.dataset.field;
    if (!field) {
      return;
    }
    const wrapper = node.closest("[data-block-id]");
    if (!wrapper) {
      return;
    }
    const sectionId = Number(wrapper.dataset.blockId);
    const section = store.section(sectionId);
    if (!section) {
      return;
    }
    hooks.select(sectionId);
    const before = node.textContent;
    editing = { node, field, sectionId, before };
    node.setAttribute("contenteditable", "true");
    node.classList.add("is-editing-field");
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  document.addEventListener("click", (event) => {
    const wrapper = event.target.closest ? event.target.closest("[data-block-id]") : null;
    if (!wrapper || editing) {
      return;
    }
    if (event.target.closest("a")) {
      event.preventDefault();
    }
    hooks.select(Number(wrapper.dataset.blockId));
  });

  document.addEventListener("dblclick", (event) => {
    const node = event.target.closest ? event.target.closest("[data-field]") : null;
    if (!node) {
      return;
    }
    event.preventDefault();
    beginEdit(node);
  });

  document.addEventListener("keydown", (event) => {
    if (!editing) {
      return;
    }
    const kind = kindOf(store.section(editing.sectionId) || { type: "" }, editing.field);
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit(false);
      return;
    }
    if (event.key === "Enter" && (SINGLE_LINE_KINDS.includes(kind) || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  });

  document.addEventListener("focusout", (event) => {
    if (editing && event.target === editing.node) {
      commit();
    }
  });

  return { render, markSelection, syncDirty, editable };
}
