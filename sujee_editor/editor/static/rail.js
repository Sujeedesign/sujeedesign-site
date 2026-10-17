/* Rail des blocs : ordre, duplication, visibilité, suppression, ajout.
   Les changements de structure sont immédiats ; un bloc ajouté naît masqué et
   en brouillon, il n'apparaît en public qu'après publication. */

import { EditorApiError } from "./api.js";

export function mountRail(context, hooks) {
  const { store, api } = context;
  const root = document.createElement("aside");
  root.className = "sjd-rail";
  root.setAttribute("aria-label", "Blocs de la page");
  document.body.appendChild(root);

  let paletteOpen = false;

  function item(section) {
    const row = document.createElement("li");
    row.className = "sjd-rail__item";
    row.dataset.blockId = String(section.id);
    row.dataset.blockVisible = section.visible ? "1" : "0";
    row.classList.toggle("is-selected", Number(context.selected) === section.id);

    const label = document.createElement("button");
    label.type = "button";
    label.className = "sjd-rail__label sjd-rail__button";
    label.textContent = section.label || section.type;
    label.title = `${section.label || section.type} · ${section.type}`;
    label.addEventListener("click", () => {
      hooks.select(section.id);
      const node = document.querySelector(`[data-block-id="${section.id}"]`);
      if (node) {
        node.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });

    const actions = document.createElement("span");
    actions.className = "sjd-rail__actions";
    actions.append(
      action("↑", "Monter", () => call(() => api.move(section.id, -1), section.id)),
      action("↓", "Descendre", () => call(() => api.move(section.id, 1), section.id)),
      action("⧉", "Dupliquer", () => call(() => api.duplicate(section.id), section.id)),
      action(section.visible ? "◉" : "◌", section.visible ? "Masquer" : "Afficher", () => call(() => api.toggle(section.id), section.id)),
      action("✕", "Supprimer", () => remove(section)),
    );
    row.append(label, actions);
    return row;
  }

  function action(symbol, title, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sjd-rail__button sjd-rail__icon";
    button.textContent = symbol;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  }

  async function call(operation, sectionId) {
    try {
      const payload = await operation();
      if (payload.sections) {
        store.replaceSections(payload.sections);
      }
      if (payload.section) {
        store.applySection(payload.section);
      }
      hooks.select(payload.section ? payload.section.id : sectionId);
      context.refresh();
    } catch (error) {
      fail(error);
    }
  }

  async function remove(section) {
    const label = section.label || section.type;
    if (!window.confirm(`Supprimer le bloc « ${label} » ?`)) {
      return;
    }
    try {
      const payload = await api.remove(section.id);
      store.replaceSections(payload.sections);
      hooks.select(null);
      context.refresh();
      context.notice(`Bloc « ${label} » supprimé.`, "info");
    } catch (error) {
      fail(error);
    }
  }

  function fail(error) {
    if (error instanceof EditorApiError) {
      context.notice(error.message, error.status === 409 ? "error" : "warn");
    } else {
      context.notice("Action impossible : réseau indisponible.", "error");
    }
  }

  async function addBlock(type) {
    try {
      const payload = await api.add(type, "", null);
      if (payload.sections) {
        store.replaceSections(payload.sections);
      }
      if (payload.section) {
        store.applySection(payload.section);
        hooks.select(payload.section.id);
      }
      paletteOpen = false;
      context.refresh();
      context.notice("Bloc ajouté en brouillon : il apparaîtra après publication.", "info");
      window.location.hash = `bloc-${payload.section ? payload.section.id : ""}`;
      window.location.reload();
    } catch (error) {
      fail(error);
    }
  }

  function palette() {
    const box = document.createElement("div");
    box.className = "sjd-rail__palette";
    store.blocks.forEach((block) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sjd-rail__button";
      button.textContent = block.label;
      button.title = block.name;
      button.addEventListener("click", () => addBlock(block.name));
      box.appendChild(button);
    });
    return box;
  }

  function render() {
    root.textContent = "";
    const title = document.createElement("p");
    title.className = "sjd-panel__title";
    title.textContent = `Blocs (${store.sections.length})`;
    const list = document.createElement("ul");
    list.className = "sjd-rail__list";
    store.sections.forEach((section) => list.appendChild(item(section)));

    const add = document.createElement("button");
    add.type = "button";
    add.className = "sjd-rail__button";
    add.textContent = paletteOpen ? "Fermer la liste" : "Ajouter un bloc";
    add.addEventListener("click", () => {
      paletteOpen = !paletteOpen;
      render();
    });

    root.append(title, list, add);
    if (paletteOpen) {
      root.appendChild(palette());
    }
  }

  render();
  return { render };
}
