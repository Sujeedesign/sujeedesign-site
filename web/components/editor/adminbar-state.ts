/**
 * État partagé du bandeau admin.
 *
 * Un seul et même bandeau pour tout le site : `AdminBar` l'affiche, `EditorRuntime`
 * lui pousse l'état de la session d'édition (utilisateur, modifications en attente,
 * publication en cours) et lui donne les actions à déclencher. Évite les deux
 * barres concurrentes (bannière admin + dock de l'éditeur).
 */

export type AdminState = {
  ready: boolean;
  user: string;
  slug: string;
  editing: boolean;
  pending: boolean;
  publishReady: boolean;
  publishing: boolean;
};

export type AdminActions = {
  quit?: () => void;
  publish?: () => void;
};

const initialState: AdminState = {
  ready: false,
  user: "",
  slug: "home",
  editing: false,
  pending: false,
  publishReady: false,
  publishing: false,
};

let state: AdminState = { ...initialState };
let actions: AdminActions = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AdminState {
  return state;
}

export function patchState(next: Partial<AdminState>): void {
  const merged = { ...state, ...next };
  const changed = (Object.keys(merged) as (keyof AdminState)[]).some((key) => merged[key] !== state[key]);
  if (!changed) return;
  state = merged;
  emit();
}

export function getActions(): AdminActions {
  return actions;
}

export function setActions(next: AdminActions): void {
  actions = { ...actions, ...next };
  emit();
}
