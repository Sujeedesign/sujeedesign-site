/* Panneau du bloc sélectionné : champs générés depuis le schéma du bloc.
   Aucun champ n'est écrit en dur : le serveur envoie le schéma, le panneau le rend. */

import { EditorApiError } from "./api.js";

const SIMPLE_KINDS = ["text", "html-line", "textarea", "html", "bool", "number", "choice"];
const LIST_KINDS = ["lines"];

export function mountPanel(context, hooks) {
  const { store, api } = context;
  const root = document.createElement("section");
  root.className = "sjd-panel";
  root.setAttribute("aria-label", "Réglages du bloc");
  document.body.appendChild(root);
  let media = null;

  function value(section, field) {
    const data = section.effective || {};
    return Object.prototype.hasOwnProperty.call(data, field.name) ? data[field.name] : defaultOf(field);
  }

  function defaultOf(field) {
    if (field.kind === "bool") {
      return false;
    }
    if (field.kind === "number") {
      return 0;
    }
    if (["lines", "items", "images", "ctas"].includes(field.kind)) {
      return [];
    }
    if (field.kind === "choice") {
      return (field.choices || [])[0] || "";
    }
    return "";
  }

  function labelFor(field) {
    const text = document.createElement("label");
    text.className = "sjd-panel__label";
    text.textContent = field.label || field.name;
    return text;
  }

  async function writeField(section, field, raw) {
    try {
      const payload = await api.field(section.id, field.name, raw, section.draft_version);
      store.applySection(payload.section);
      hooks.select(section.id);
      context.refresh();
    } catch (error) {
      fail(error);
    }
  }

  async function writeData(section, patch) {
    const data = Object.assign({}, section.effective || {}, patch);
    try {
      const payload = await api.draft(section.id, data, section.draft_version);
      store.applySection(payload.section);
      hooks.select(section.id);
      context.refresh();
    } catch (error) {
      fail(error);
    }
  }

  function fail(error) {
    const box = root.querySelector(".sjd-panel__error") || document.createElement("p");
    box.className = "sjd-panel__error";
    if (error instanceof EditorApiError) {
      box.textContent = error.field ? `${error.field} : ${error.message}` : error.message;
      if (error.status === 401) {
        context.lock();
      }
      if (error.status === 409) {
        context.reload();
      }
    } else {
      box.textContent = "Écriture impossible : réseau indisponible.";
    }
    if (!box.parentNode) {
      root.prepend(box);
    }
  }

  function mediaField(section, field, current) {
    const box = document.createElement("div");
    const input = document.createElement("input");
    input.type = "text";
    input.value = current || "";
    input.addEventListener("change", () => writeField(section, field, input.value.trim()));
    box.append(input);
    if (media && media.length) {
      const select = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Choisir une image existante…";
      select.appendChild(empty);
      media.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.path || `medias/${item.filename}`;
        option.textContent = item.filename;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        if (select.value) {
          input.value = select.value;
          writeField(section, field, select.value);
        }
      });
      box.appendChild(select);
    }
    return box;
  }

  function simpleControl(section, field, current) {
    if (field.kind === "bool") {
      const row = document.createElement("div");
      row.className = "sjd-panel__check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(current);
      input.addEventListener("change", () => writeField(section, field, input.checked));
      row.append(input, labelFor(field));
      return row;
    }
    if (field.kind === "choice") {
      const select = document.createElement("select");
      (field.choices || []).forEach((choice) => {
        const option = document.createElement("option");
        option.value = choice;
        option.textContent = choice;
        option.selected = choice === current;
        select.appendChild(option);
      });
      select.addEventListener("change", () => writeField(section, field, select.value));
      return select;
    }
    if (field.kind === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.value = current === null || current === undefined ? 0 : current;
      input.addEventListener("change", () => writeField(section, field, Number(input.value || 0)));
      return input;
    }
    if (field.kind === "textarea" || field.kind === "html") {
      const area = document.createElement("textarea");
      area.rows = 4;
      area.value = current || "";
      area.addEventListener("change", () => writeField(section, field, area.value));
      return area;
    }
    const input = document.createElement("input");
    input.type = "text";
    input.value = current || "";
    input.addEventListener("change", () => writeField(section, field, input.value));
    return input;
  }

  function listControl(section, field, current) {
    const area = document.createElement("textarea");
    area.rows = 5;
    const items = Array.isArray(current) ? current : [];
    area.value = items.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join("\n");
    area.addEventListener("change", () => {
      const lines = area.value.split("\n").map((line) => line.trim()).filter(Boolean);
      writeData(section, { [field.name]: lines });
    });
    return area;
  }

  function itemControl(section, field, current) {
    const box = document.createElement("div");
    const items = Array.isArray(current) ? current.slice() : [];
    const render = () => {
      box.textContent = "";
      items.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "sjd-panel__row";
        (field.fields || []).forEach((sub) => {
          const holder = document.createElement("div");
          holder.appendChild(labelFor(sub));
          if (sub.kind === "image") {
            holder.appendChild(mediaField(section, { name: `${field.name}.${index}.${sub.name}` }, item[sub.name] || ""));
          } else {
            const input = document.createElement("input");
            input.type = "text";
            input.value = item[sub.name] === undefined || item[sub.name] === null ? "" : String(item[sub.name]);
            input.addEventListener("change", () => {
              const next = items.map((entry, position) =>
                position === index ? Object.assign({}, entry, { [sub.name]: input.value }) : entry,
              );
              writeData(section, { [field.name]: next });
            });
            holder.appendChild(input);
          }
          row.appendChild(holder);
        });
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "sjd-panel__button";
        removeButton.textContent = "Retirer";
        removeButton.addEventListener("click", () => {
          writeData(section, { [field.name]: items.filter((_, position) => position !== index) });
        });
        row.appendChild(removeButton);
        box.appendChild(row);
      });
      const addButton = document.createElement("button");
      addButton.type = "button";
      addButton.className = "sjd-panel__button";
      addButton.textContent = "Ajouter un élément";
      addButton.addEventListener("click", () => {
        const empty = {};
        (field.fields || []).forEach((sub) => {
          empty[sub.name] = "";
        });
        writeData(section, { [field.name]: items.concat([empty]) });
      });
      box.appendChild(addButton);
    };
    render();
    return box;
  }

  function control(section, field) {
    const current = value(section, field);
    if (field.kind === "image") {
      return mediaField(section, field, current);
    }
    if (LIST_KINDS.includes(field.kind)) {
      return listControl(section, field, current);
    }
    if (["items", "images", "ctas"].includes(field.kind)) {
      return itemControl(section, field, current);
    }
    if (SIMPLE_KINDS.includes(field.kind)) {
      return simpleControl(section, field, current);
    }
    const fallback = document.createElement("input");
    fallback.type = "text";
    fallback.value = typeof current === "string" ? current : JSON.stringify(current || "");
    return fallback;
  }

  function render(section) {
    const selected = section || store.section(context.selected);
    root.textContent = "";
    if (!selected) {
      const hint = document.createElement("p");
      hint.className = "sjd-panel__kind";
      hint.textContent = "Clique un bloc de la page pour le régler.";
      root.appendChild(hint);
      return;
    }
    const block = store.block(selected.type) || { label: selected.type, fields: [] };
    const title = document.createElement("p");
    title.className = "sjd-panel__title";
    title.textContent = block.label || selected.type;
    const kind = document.createElement("p");
    kind.className = "sjd-panel__kind";
    kind.textContent = selected.revised ? "Brouillon non publié" : "Publié";
    if (!selected.visible) {
      kind.textContent += " · masqué";
    }
    root.append(title, kind);
    if (block.variants && Object.keys(block.variants).length && selected.variant) {
      const variant = document.createElement("p");
      variant.className = "sjd-panel__kind";
      variant.textContent = `Variante : ${block.variants[selected.variant] || selected.variant}`;
      root.appendChild(variant);
    }
    (block.fields || []).forEach((field) => {
      root.appendChild(labelFor(field));
      root.appendChild(control(selected, field));
    });
  }

  async function loadMedia() {
    try {
      const payload = await api.media();
      media = payload.medias || [];
    } catch (error) {
      media = [];
    }
  }

  loadMedia().then(() => render(null));
  render(null);
  return { render: (section) => render(section) };
}
