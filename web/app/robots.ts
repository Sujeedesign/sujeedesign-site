import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: "https://sujeedesign.com/sitemap.xml",
    host: "https://sujeedesign.com",
  };
}
