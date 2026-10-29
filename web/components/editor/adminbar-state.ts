/**
 * État partagé du bandeau admin.
 *
 * Un seul et même bandeau pour tout le site : `AdminBar` l'affiche, `EditorRuntime`
 * lui pousse l'état de la session d'édition (utilisateur, modifications en attente,
 * publication en cours).
 *
 * Les actions ne transitent pas par des callbacks stockés ici : le bandeau publie
 * une *intention* (`editing`, `publishSeq`, `quitSeq`) et l'éditeur réagit. Un
 * callback rangé dans le store ne déclenchait aucun rendu (même objet d'état), si
 * bien que les boutons restaient branchés sur des fonctions absentes : cliquer
 * « Quitter » ne faisait rien.
 */

export type AdminState = {
  ready: boolean;
  user: string;
  slug: string;
  /** Intention : le bandeau demande l'édition, l'éditeur s'active. */
  editing: boolean;
  pending: boolean;
  publishReady: boolean;
  publishing: boolean;
  /** Compteurs d'intention : chaque incrément = une demande de l'utilisateur. */
  publishSeq: number;
  quitSeq: number;
};

const initialState: AdminState = {
  ready: false,
  user: "",
  slug: "home",
  editing: false,
  pending: false,
  publishReady: false,
  publishing: false,
  publishSeq: 0,
  quitSeq: 0,
};

let state: AdminState = { ...initialState };
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

export function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const found = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
}

/**
 * Efface un cookie côté navigateur. Le drapeau `secure` doit suivre le contexte
 * réel, sinon le navigateur refuse silencieusement de remplacer un cookie posé
 * en HTTPS.
 */
export function clearCookie(name: string): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=0; path=/; samesite=lax; max-age=0${secure}`;
}

/** Demande l'ouverture de l'édition en place (bouton « Modifier la page »). */
export function demanderEdition(): void {
  patchState({ editing: true });
}

/** Demande la fermeture de l'édition en place (bouton « Quitter l'édition »). */
export function demanderSortie(): void {
  patchState({ quitSeq: state.quitSeq + 1 });
}

/** Demande la publication des modifications en attente. */
export function demanderPublication(): void {
  patchState({ publishSeq: state.publishSeq + 1 });
}
