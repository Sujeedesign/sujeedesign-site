/* Client HTTP de l'éditeur : un seul endroit porte le jeton CSRF, les cookies et
   la transformation des erreurs du serveur en erreurs typées. */

export class EditorApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "EditorApiError";
    this.status = status;
    this.body = body || {};
  }

  get rule() {
    return (this.body.error && this.body.error.rule) || "http_" + this.status;
  }

  get field() {
    return (this.body.error && this.body.error.field) || "";
  }

  get conflictSection() {
    return this.body.section || null;
  }
}

const MESSAGES = {
  version: "La page a changé dans un autre onglet. Recharge pour voir l'état réel.",
  max_length: "Ce texte est trop long pour ce champ.",
  unknown_field: "Ce champ n'existe plus dans ce bloc.",
  bad_item: "Une valeur de liste est invalide.",
  bad_choice: "Ce choix n'est pas proposé par ce bloc.",
  bad_variant: "Cette variante n'existe pas pour ce bloc.",
  not_a_number: "Ce champ attend un nombre.",
  not_a_bool: "Ce champ attend une case à cocher.",
  bad_type: "Le type de cette valeur ne correspond pas au champ.",
  required: "Ce champ est obligatoire.",
  too_many: "Trop d'éléments pour ce champ.",
  bad_extension: "Ce format de fichier n'est pas accepté.",
  too_large: "Ce fichier est trop lourd (8 Mo maximum).",
  empty_file: "Ce fichier est vide.",
  http_401: "Session expirée. Reconnecte-toi pour continuer.",
  http_403: "Écriture refusée (session ou origine).",
  http_404: "Ce bloc ou cette page n'existe plus.",
};

export function messageFor(rule) {
  return MESSAGES[rule] || "Écriture refusée par le serveur.";
}

export function createApi(store) {
  async function request(method, path, body) {
    const base = String(store.api || "").replace(/\/$/, "");
    const options = {
      method,
      credentials: "same-origin",
      headers: {
        "X-SJD-CSRF": store.csrf || "",
        Accept: "application/json",
      },
    };
    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
    const response = await fetch(base + path, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new EditorApiError(messageFor((payload.error && payload.error.rule) || "http_" + response.status), response.status, payload);
    }
    return payload;
  }

  const page = () => store.page.id;

  return {
    request,
    state: () => request("GET", `/pages/${page()}/state`),
    field: (sectionId, field, value, version) =>
      request("PATCH", `/pages/${page()}/sections/${sectionId}`, { field, value, expected_version: version }),
    draft: (sectionId, data, version) =>
      request("PUT", `/pages/${page()}/sections/${sectionId}/draft`, { data, expected_version: version }),
    move: (sectionId, offset) =>
      request("POST", `/pages/${page()}/sections/${sectionId}/move`, { offset }),
    duplicate: (sectionId) => request("POST", `/pages/${page()}/sections/${sectionId}/duplicate`, {}),
    toggle: (sectionId) => request("POST", `/pages/${page()}/sections/${sectionId}/toggle`, {}),
    remove: (sectionId) => request("DELETE", `/pages/${page()}/sections/${sectionId}`),
    add: (type, variant, position) =>
      request("POST", `/pages/${page()}/sections`, { type, variant: variant || "", position }),
    publish: () => request("POST", `/pages/${page()}/publish`, {}),
    revisions: () => request("GET", `/pages/${page()}/revisions`),
    restore: (revisionId) => request("POST", `/pages/${page()}/revisions/${revisionId}/restore`, {}),
    media: () => request("GET", "/media"),
  };
}
