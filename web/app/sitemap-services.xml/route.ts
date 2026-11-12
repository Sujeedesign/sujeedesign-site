import { routes, serviceHref, serviceSlugs } from "@/lib/routes";
import { pageUpdated, serviceUpdated } from "@/lib/content/freshness";

const SITE_URL = "https://sujeedesign.com";

/**
 * Sitemap dédié aux pages services.
 *
 * Pourquoi un second sitemap : le sitemap principal est lu par Google mais ses
 * entrées `/services` et `/services/direction-artistique` n'ont jamais reçu de
 * crawl (« Google ne reconnaît pas cette URL »). Un fichier court, dédié à cinq
 * URL et soumis séparément, donne à Google un motif de relire ces adresses sans
 * noyer le signal dans trente entrées.
 */
export function GET() {
  const entries = serviceSlugs.map((slug) => {
    const href = serviceHref(slug);
    const lastMod = slug === "agents-ia" ? pageUpdated(routes.agentsIa) : serviceUpdated(slug);
    return `  <url>
    <loc>${SITE_URL}${href}</loc>
    <lastmod>${lastMod.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
