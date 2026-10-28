/**
 * Sérialise un graphe schema.org dans une balise `application/ld+json`.
 *
 * Le JSON est échappé (`<` → `\u003c`) pour qu'un texte contenant `</script>`
 * ne casse pas le document.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
