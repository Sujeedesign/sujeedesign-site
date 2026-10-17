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

  function isNarrow() {
    return window.innerWidth < 900;
  }

  // Écrans étroits : le rail et le panneau sont des vues plein écran, ouvertes
  // une à la fois depuis la barre. Sur grand écran, les deux sont toujours là.
  let wasNarrow = null;

  function layout() {
    const narrow = isNarrow();
    if (narrow === wasNarrow) {
      // Redimensionnement sans changer de camp (barre d'URL d'un téléphone) :
      // on ne referme pas ce qui est ouvert.
      bar.render();
      return;
    }
    wasNarrow = narrow;
    if (narrow) {
      rail.hide();
      panel.hide();
    } else {
      rail.show();
      panel.show();
    }
    bar.render();
  }

  function toggleRail() {
    if (rail.isOpen()) {
      rail.hide();
    } else {
      panel.hide();
      rail.show();
    }
    bar.render();
  }

  function togglePanel() {
    if (panel.isOpen()) {
      panel.hide();
      bar.render();
      return;
    }
    if (context.selected === null) {
      notice("Choisis d'abord un bloc.", "info");
      return;
    }
    rail.hide();
    panel.show();
    bar.render();
  }

  function tools() {
    if (!isNarrow()) {
      return [];
    }
    return [
      { label: "Blocs", pressed: rail.isOpen(), onClick: toggleRail },
      { label: "Ce bloc", pressed: panel.isOpen(), onClick: togglePanel },
      {
        label: "Page",
        pressed: !rail.isOpen() && !panel.isOpen(),
        onClick: () => {
          rail.hide();
          panel.hide();
          bar.render();
        },
      },
    ];
  }

  function selectFromList(sectionId) {
    select(sectionId);
    if (isNarrow()) {
      rail.hide();
      panel.show();
      bar.render();
    }
  }

  const canvas = mountCanvas(context, { select });
  const rail = mountRail(context, { select: selectFromList, onToggle: () => bar && bar.render() });
  const panel = mountPanel(context, { onToggle: () => bar && bar.render() });
  const bar = mountBar(context, { refresh, notice, tools });

  refresh();
  layout();
  window.addEventListener("resize", layout);
  document.documentElement.dataset.editorReady = "1";
  window.sjdEditor = context;
}
