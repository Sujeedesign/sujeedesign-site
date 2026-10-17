/* Amorce de l'éditeur : lit l'état injecté, expose le client et l'état, et rend
   la main aux modules du canevas, du rail et du panneau. */

import { createApi } from "./api.js";
import { createStore, readState } from "./state.js";
import { mountCanvas } from "./canvas.js";
import { mountPanel } from "./panel.js";
import { mountRail } from "./rail.js";
import { mountBar } from "./bar.js";

const store = createStore(readState());

if (store) {
  const api = createApi(store);
  const context = { store, api, selected: null, locked: false, refresh, notice, reload, lock };

  function reload() {
    window.location.reload();
  }

  function lock() {
    context.locked = true;
    document.body.classList.add("sjd-editing-locked");
    bar.notice("Session expirée : reconnecte-toi pour continuer. Aucune modification n'est perdue.", "error");
  }

  function refresh(payload) {
    if (payload) {
      store.setState(payload);
    }
    canvas.render();
    rail.render();
    panel.render();
    bar.render();
  }

  function notice(message, tone) {
    bar.notice(message, tone);
  }

  function select(sectionId) {
    context.selected = sectionId === null || sectionId === undefined ? null : Number(sectionId);
    canvas.markSelection();
    rail.render();
    panel.render(store.section(context.selected));
  }

  const canvas = mountCanvas(context, { select });
  const rail = mountRail(context, { select });
  const panel = mountPanel(context, { select });
  const bar = mountBar(context, { refresh, notice });

  refresh();
  document.documentElement.dataset.editorReady = "1";
  window.sjdEditor = context;
}
