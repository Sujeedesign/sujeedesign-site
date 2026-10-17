/* État de l'éditeur côté navigateur : lecture de l'état injecté par le serveur,
   recherche par identifiant, suivi des versions de brouillon. */

export function readState() {
  const node = document.getElementById("sjd-editor-data");
  if (!node) {
    return null;
  }
  try {
    const parsed = JSON.parse(node.textContent || "{}");
    return parsed && parsed.page ? parsed : null;
  } catch (error) {
    return null;
  }
}

export function createStore(initial) {
  const data = initial;

  return {
    get data() {
      return data;
    },
    get page() {
      return data.page;
    },
    get api() {
      return data.api;
    },
    get assets() {
      return data.assets || "";
    },
    get csrf() {
      return data.csrf || "";
    },
    set csrf(token) {
      data.csrf = token;
    },
    get blocks() {
      return data.blocks || [];
    },
    get sections() {
      return data.sections || [];
    },
    get revisions() {
      return data.revisions || [];
    },
    section(id) {
      const wanted = Number(id);
      return (data.sections || []).find((section) => section.id === wanted) || null;
    },
    block(type) {
      return (data.blocks || []).find((block) => block.name === type) || null;
    },
    applySection(section) {
      const list = data.sections || [];
      const index = list.findIndex((item) => item.id === section.id);
      if (index >= 0) {
        list[index] = section;
      } else {
        list.push(section);
      }
    },
    replaceSections(sections) {
      data.sections = sections || [];
    },
    replaceRevisions(revisions) {
      data.revisions = revisions || [];
    },
    setState(payload) {
      if (!payload) {
        return;
      }
      if (payload.csrf) {
        data.csrf = payload.csrf;
      }
      if (payload.sections) {
        data.sections = payload.sections;
      }
      if (payload.revisions) {
        data.revisions = payload.revisions;
      }
      if (payload.page) {
        data.page = payload.page;
      }
    },
    hasPending() {
      return (data.sections || []).some((section) => section.revised);
    },
    pendingCount() {
      return (data.sections || []).filter((section) => section.revised).length;
    },
  };
}
