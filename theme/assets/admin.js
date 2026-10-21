/* Back office : éditeur de sections, médias, messages, réglages. */
(function () {
  "use strict";

  const state = { schema: null, sections: [], medias: null };

  async function api(method, url, body) {
    const init = { method, headers: { Accept: "application/json" }, credentials: "same-origin" };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      const csrf = document.querySelector('meta[name="sjd-csrf"]')?.content;
      if (csrf) init.headers["X-SJD-CSRF"] = csrf;
      init.body = JSON.stringify(body);
    }
    const response = await fetch(url, init);
    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }
    if (!response.ok) {
      const detail = data && (data.detail || data.message);
      throw new Error(typeof detail === "string" ? detail : `Erreur ${response.status}`);
    }
    return data;
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, "");
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(key, value);
    });
    (children || []).forEach((child) => node.appendChild(child));
    return node;
  }

  function notify(message, isError) {
    const node = document.getElementById("editorStatus") || document.getElementById("adminStatus");
    if (!node) {
      if (isError) window.alert(message);
      return;
    }
    node.textContent = message;
    node.className = "admin-note" + (isError ? " is-error" : " is-ok");
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      node.textContent = "";
    }, 6000);
  }

  async function loadSchema() {
    if (!state.schema) {
      const data = await api("GET", "/api/admin/schema");
      state.schema = data.types;
    }
    return state.schema;
  }

  /* ---------------------------------------------------------- champs */

  function fieldControl(field, value, onChange) {
    const type = field.type || "text";
    if (type === "bool") {
      const wrap = el("div", { class: "field field--check" });
      const input = el("input", { type: "checkbox", id: `fld-${field.name}` });
      input.checked = Boolean(value);
      input.addEventListener("change", () => onChange(input.checked));
      wrap.appendChild(input);
      wrap.appendChild(el("label", { for: `fld-${field.name}`, text: field.label }));
      return wrap;
    }
    if (type === "choice") {
      const select = el("select");
      (field.choices || []).forEach((choice) => {
        const option = el("option", { value: choice, text: choice });
        if (choice === value) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => onChange(select.value));
      return select;
    }
    if (type === "lines") {
      const textarea = el("textarea", { rows: Math.max(2, (value || []).length + 1) });
      textarea.value = (value || []).join("\n");
      textarea.addEventListener("change", () =>
        onChange(textarea.value.split("\n").map((line) => line.trim()).filter((line) => line.length))
      );
      return textarea;
    }
    if (type === "html" || type === "textarea") {
      const textarea = el("textarea", { rows: type === "html" ? 6 : 3 });
      textarea.value = value || "";
      textarea.addEventListener("change", () => onChange(textarea.value));
      return textarea;
    }
    if (type === "number") {
      const input = el("input", { type: "number" });
      input.value = value === undefined || value === null ? "" : value;
      input.addEventListener("change", () => onChange(Number(input.value) || 0));
      return input;
    }
    if (type === "media") {
      const wrap = el("div", { class: "input-with-media" });
      const input = el("input");
      input.value = value || "";
      input.addEventListener("change", () => onChange(input.value));
      wrap.appendChild(input);
      wrap.appendChild(
        el("button", {
          class: "btn btn--small",
          type: "button",
          text: "Média",
          onclick: () => openMediaPicker(input),
        })
      );
      return wrap;
    }
    const input = el("input");
    input.value = value || "";
    input.addEventListener("change", () => onChange(input.value));
    return input;
  }

  function itemsField(field, value, onChange) {
    const rows = Array.isArray(value) ? value.slice() : [];
    const container = el("div", { class: "items" });
    const subfields = field.fields || [];

    function redraw() {
      container.innerHTML = "";
      rows.forEach((row, index) => {
        const card = el("div", { class: "item-row" });
        subfields.forEach((sub) => {
          const wrap = el("div", { class: `field field--${sub.type}` });
          wrap.appendChild(el("label", { text: sub.label }));
          wrap.appendChild(
            fieldControl(sub, row[sub.name], (next) => {
              rows[index][sub.name] = next;
              onChange(rows);
            })
          );
          card.appendChild(wrap);
        });
        card.appendChild(
          el("div", {
            class: "item-row-actions",
            children: [
              el("button", {
                class: "btn btn--small btn--danger",
                type: "button",
                text: "Retirer",
                onclick: () => {
                  rows.splice(index, 1);
                  redraw();
                  onChange(rows);
                },
              }),
            ],
          })
        );
        container.appendChild(card);
      });
      container.appendChild(
        el("button", {
          class: "btn btn--small",
          type: "button",
          text: "+ Ajouter une entrée",
          onclick: () => {
            const empty = {};
            subfields.forEach((sub) => {
              empty[sub.name] = sub.type === "lines" ? [] : sub.type === "bool" ? false : "";
            });
            rows.push(empty);
            redraw();
            onChange(rows);
          },
        })
      );
    }

    redraw();
    return container;
  }

  function imagesField(field, value, onChange) {
    const normalised = (Array.isArray(value) ? value : []).map((item) =>
      typeof item === "string" ? { src: item, alt: "", caption: "" } : { alt: "", caption: "", ...item }
    );
    return itemsField(
      {
        name: field.name,
        type: "items",
        fields: [
          { name: "src", label: "Image", type: "media" },
          { name: "alt", label: "Texte alternatif", type: "text" },
          { name: "caption", label: "Légende", type: "text" },
        ],
      },
      normalised,
      onChange
    );
  }

  function fieldGroup(field, section, index) {
    const wrap = el("div", { class: "field" + (field.type === "html" ? " field--wide" : "") });
    if (field.type !== "bool") wrap.appendChild(el("label", { text: field.label }));
    let control;
    if (field.type === "items") {
      control = itemsField(field, section.data[field.name], (next) => {
        section.data[field.name] = next;
        section.dirty = true;
      });
    } else if (field.type === "images") {
      control = imagesField(field, section.data[field.name], (next) => {
        section.data[field.name] = next;
        section.dirty = true;
      });
    } else {
      control = fieldControl(field, section.data[field.name], (next) => {
        section.data[field.name] = next;
        section.dirty = true;
      });
    }
    wrap.appendChild(control);
    if (field.hint) wrap.appendChild(el("p", { class: "field-hint", text: field.hint }));
    return wrap;
  }

  /* ---------------------------------------------------------- sections */

  async function saveSection(section, card) {
    try {
      await api("PATCH", `/api/admin/sections/${section.id}`, {
        label: section.label,
        variant: section.variant,
        visible: section.visible ? 1 : 0,
        data: section.data,
      });
      section.dirty = false;
      notify(`Section « ${section.type_label || section.type} » enregistrée.`);
    } catch (error) {
      notify(error.message, true);
    }
  }

  function sectionCard(section, index, total) {
    const schema = state.schema[section.type] || { fields: [], variants: {} };
    const card = el("article", { class: "section-card", "data-id": section.id });

    const head = el("div", { class: "section-head" });
    head.appendChild(el("span", { class: "section-index", text: String(index + 1).padStart(2, "0") }));
    head.appendChild(el("strong", { text: section.type_label || section.type }));
    const labelInput = el("input", { class: "section-label-input", value: section.label || "", placeholder: "Libellé interne" });
    labelInput.addEventListener("change", () => {
      section.label = labelInput.value;
      section.dirty = true;
    });
    head.appendChild(labelInput);

    const variants = Object.entries(schema.variants || {});
    if (variants.length) {
      const select = el("select", { class: "section-variant" });
      variants.forEach(([name, label]) => {
        const option = el("option", { value: name, text: label });
        if ((section.variant || "") === name) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener("change", () => {
        section.variant = select.value;
        const data = section.data || {};
        data._variant = select.value;
        section.data = data;
        section.dirty = true;
      });
      head.appendChild(select);
    }

    const visible = el("input", { type: "checkbox", id: `visible-${section.id}` });
    visible.checked = Boolean(section.visible);
    visible.addEventListener("change", () => {
      section.visible = visible.checked ? 1 : 0;
      section.dirty = true;
    });
    const visibleLabel = el("label", { class: "section-visible", for: `visible-${section.id}` });
    visibleLabel.appendChild(visible);
    visibleLabel.appendChild(document.createTextNode(" visible"));
    head.appendChild(visibleLabel);

    head.appendChild(
      el("div", {
        class: "section-actions",
        children: [
          el("button", {
            class: "btn btn--small",
            type: "button",
            text: "↑",
            title: "Monter",
            disabled: index === 0,
            onclick: async () => {
              await api("POST", `/api/admin/sections/${section.id}/deplacer`, { offset: -1 });
              await loadSections();
            },
          }),
          el("button", {
            class: "btn btn--small",
            type: "button",
            text: "↓",
            title: "Descendre",
            disabled: index === total - 1,
            onclick: async () => {
              await api("POST", `/api/admin/sections/${section.id}/deplacer`, { offset: 1 });
              await loadSections();
            },
          }),
          el("button", {
            class: "btn btn--small",
            type: "button",
            text: "Dupliquer",
            onclick: async () => {
              await api("POST", `/api/admin/sections/${section.id}/dupliquer`, {});
              await loadSections();
            },
          }),
          el("button", {
            class: "btn btn--small btn--danger",
            type: "button",
            text: "Supprimer",
            onclick: async () => {
              if (!window.confirm("Supprimer cette section ?")) return;
              await api("DELETE", `/api/admin/sections/${section.id}`);
              await loadSections();
            },
          }),
        ],
      })
    );
    card.appendChild(head);

    const body = el("div", { class: "section-body" });
    (schema.fields || []).forEach((field) => body.appendChild(fieldGroup(field, section, index)));
    card.appendChild(body);

    const foot = el("div", { class: "section-foot" });
    foot.appendChild(
      el("button", {
        class: "btn btn--primary btn--small",
        type: "button",
        text: "Enregistrer cette section",
        onclick: () => saveSection(section, card),
      })
    );
    card.appendChild(foot);
    return card;
  }

  async function loadSections() {
    const list = document.getElementById("sectionList");
    if (!list) return;
    const pageId = list.dataset.page;
    await loadSchema();
    const data = await api("GET", `/api/admin/pages/${pageId}/sections`);
    state.sections = data.sections.map((section) => ({
      ...section,
      type_label: (state.schema[section.type] || {}).label || section.type,
    }));
    list.innerHTML = "";
    state.sections.forEach((section, index) => list.appendChild(sectionCard(section, index, state.sections.length)));
  }

  /* ---------------------------------------------------------- médias */

  async function loadMedias(force) {
    if (!state.medias || force) {
      state.medias = (await api("GET", "/api/admin/medias")).medias;
    }
    return state.medias;
  }

  async function openMediaPicker(targetInput) {
    const dialog = el("dialog", { class: "media-dialog" });
    const head = el("div", { class: "media-dialog-head" });
    head.appendChild(el("h2", { text: "Choisir un média" }));
    const file = el("input", { type: "file", accept: "image/*,.pdf" });
    const upload = el("button", { class: "btn btn--small", type: "button", text: "Téléverser" });
    upload.addEventListener("click", async () => {
      if (!file.files || !file.files[0]) return;
      const body = new FormData();
      body.append("file", file.files[0]);
      const response = await fetch("/api/admin/medias", { method: "POST", body, credentials: "same-origin" });
      if (!response.ok) {
        notify("Téléversement refusé.", true);
        return;
      }
      const created = await response.json();
      targetInput.value = created.path;
      targetInput.dispatchEvent(new Event("change"));
      await loadMedias(true);
      dialog.close();
      notify("Média ajouté.");
    });
    head.appendChild(file);
    head.appendChild(upload);
    head.appendChild(el("button", { class: "btn btn--small", type: "button", text: "Fermer", onclick: () => dialog.close() }));
    dialog.appendChild(head);

    const medias = await loadMedias(true);
    const grid = el("div", { class: "media-grid" });
    medias.forEach((media) => {
      const tile = el("button", { class: "media-tile", type: "button" });
      tile.appendChild(el("img", { src: media.path, alt: media.alt || media.original_filename || media.filename, loading: "lazy" }));
      tile.appendChild(el("span", { text: media.original_filename || media.filename }));
      tile.addEventListener("click", () => {
        targetInput.value = media.path;
        targetInput.dispatchEvent(new Event("change"));
        dialog.close();
      });
      grid.appendChild(tile);
    });
    if (!medias.length) grid.appendChild(el("p", { class: "muted", text: "Aucun média pour l'instant." }));
    dialog.appendChild(grid);
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
  }

  /* ---------------------------------------------------------- écrans */

  function initPageEditor() {
    const list = document.getElementById("sectionList");
    if (list) {
      loadSections().catch((error) => notify(error.message, true));

      const addButton = document.getElementById("addSection");
      if (addButton) {
        addButton.addEventListener("click", async () => {
          const type = document.getElementById("newSectionType").value;
          try {
            await api("POST", `/api/admin/pages/${list.dataset.page}/sections`, { type });
            await loadSections();
            notify("Section ajoutée.");
          } catch (error) {
            notify(error.message, true);
          }
        });
      }

      const savePage = document.getElementById("savePage");
      if (savePage) {
        savePage.addEventListener("click", async () => {
          const values = collectPageValues();
          try {
            await api("PATCH", `/api/admin/pages/${list.dataset.page}`, values);
            notify("Page enregistrée.");
          } catch (error) {
            notify(error.message, true);
          }
        });
      }
    }

    document.querySelectorAll("[data-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await api("POST", `/api/admin/pages/${button.dataset.page}/statut`, { status: button.dataset.status });
          window.location.reload();
        } catch (error) {
          notify(error.message, true);
        }
      });
    });

    document.querySelectorAll("[data-restore]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("Restaurer cette version ? La version actuelle sera sauvegardée.")) return;
        try {
          await api("POST", `/api/admin/revisions/${button.dataset.restore}/restaurer`, {});
          window.location.reload();
        } catch (error) {
          notify(error.message, true);
        }
      });
    });

    document.querySelectorAll("[data-upload-target]").forEach((button) => {
      button.addEventListener("click", () => openMediaPicker(document.querySelector(button.dataset.uploadTarget)));
    });
  }

  function collectPageValues() {
    const values = {};
    const nodes = document.querySelectorAll('#pageForm [name], [data-form="pageForm"]');
    nodes.forEach((node) => {
      if (!node.name) return;
      if (node.type === "checkbox") values[node.name] = node.checked;
      else if (node.name === "categories") {
        values.categories = node.value.split(",").map((part) => part.trim()).filter((part) => part.length);
      } else if (node.name === "year" || node.name === "num" || node.name === "position" || node.name === "menu_position") {
        values[node.name] = Number(node.value) || 0;
      } else values[node.name] = node.value;
    });
    return values;
  }

  function initPagesList() {
    const newPage = document.getElementById("newPage");
    if (newPage) {
      newPage.addEventListener("click", async () => {
        const title = window.prompt("Titre de la nouvelle page ?");
        if (!title) return;
        try {
          const created = await api("POST", "/api/admin/pages", { title, kind: newPage.dataset.kind || "page" });
          window.location.href = `/admin/pages/${created.id}`;
        } catch (error) {
          notify(error.message, true);
        }
      });
    }
    document.querySelectorAll("[data-delete-page]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm(`Supprimer « ${button.dataset.title} » ?`)) return;
        try {
          await api("DELETE", `/api/admin/pages/${button.dataset.deletePage}`);
          window.location.reload();
        } catch (error) {
          notify(error.message, true);
        }
      });
    });
  }

  function initMediaScreen() {
    const form = document.getElementById("mediaUpload");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const body = new FormData(form);
        const response = await fetch("/api/admin/medias", { method: "POST", body, credentials: "same-origin" });
        if (!response.ok) {
          notify("Téléversement refusé.", true);
          return;
        }
        window.location.reload();
      });
    }
    document.querySelectorAll("[data-save-media]").forEach((button) => {
      button.addEventListener("click", async () => {
        const card = button.closest("[data-media-id]");
        try {
          await api("PATCH", `/api/admin/medias/${card.dataset.mediaId}`, {
            alt: card.querySelector("[name=alt]").value,
            caption: card.querySelector("[name=caption]").value,
            credit: card.querySelector("[name=credit]").value,
          });
          notify("Média mis à jour.");
        } catch (error) {
          notify(error.message, true);
        }
      });
    });
    document.querySelectorAll("[data-delete-media]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!window.confirm("Supprimer ce média ?")) return;
        await api("DELETE", `/api/admin/medias/${button.dataset.deleteMedia}`);
        window.location.reload();
      });
    });
  }

  function initMessages() {
    document.querySelectorAll("[data-message-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          await api("PATCH", `/api/admin/messages/${button.dataset.messageId}`, { status: button.dataset.messageStatus });
          window.location.reload();
        } catch (error) {
          notify(error.message, true);
        }
      });
    });
  }

  function initSettings() {
    const form = document.getElementById("settingsForm");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = {};
        new FormData(form).forEach((value, key) => {
          values[key] = value;
        });
        try {
          await api("POST", "/api/admin/reglages", values);
          notify("Réglages enregistrés.");
        } catch (error) {
          notify(error.message, true);
        }
      });
    }
    const redirectForm = document.getElementById("redirectForm");
    if (redirectForm) {
      redirectForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = {};
        new FormData(redirectForm).forEach((value, key) => {
          values[key] = value;
        });
        try {
          await api("POST", "/api/admin/redirections", values);
          window.location.reload();
        } catch (error) {
          notify(error.message, true);
        }
      });
    }
    document.querySelectorAll("[data-delete-redirect]").forEach((button) => {
      button.addEventListener("click", async () => {
        await api("DELETE", `/api/admin/redirections?path=${encodeURIComponent(button.dataset.deleteRedirect)}`);
        window.location.reload();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initPageEditor();
    initPagesList();
    initMediaScreen();
    initMessages();
    initSettings();
  });
})();
