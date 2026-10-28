import { NextResponse, type NextRequest } from "next/server";

const APEX = "sujeedesign.com";

/** URL canonique absolue en https sur l'apex, à partir d'un chemin et d'une query. */
function canonical(origin: string, pathname: string, search = ""): URL {
  const target = new URL(`${pathname}${search}`, origin);
  const host = target.hostname.toLowerCase();
  if (host === APEX || host === `www.${APEX}`) {
    target.protocol = "https:";
    target.hostname = APEX;
    target.port = "";
  }
  return target;
}

/**
 * Trois règles d'URL, toutes en amont du rendu :
 *  - `www` rejoint l'apex en 301 (un seul hôte public) ;
 *  - l'ancienne préversion `/v5` rejoint la racine en 301 direct. Next
 *    normaliserait `/v5/` en 308 vers `/v5` avant d'appliquer la règle de
 *    `next.config.ts`, ce qui faisait deux sauts pour les robots ;
 *  - le slash final est retiré en 308, comme le faisait Next. Ce dernier point
 *    est nécessaire parce que `next.config.ts` pose `skipTrailingSlashRedirect`
 *    (sinon la normalisation interne reprend la main avant ce middleware).
 */
export function middleware(request: NextRequest): NextResponse {
  const [host = ""] = (request.headers.get("host") ?? "").split(":");
  const { pathname, search, origin } = request.nextUrl;

  if (host.toLowerCase() === `www.${APEX}`) {
    // `request.nextUrl.origin` vaut l'origine interne du serveur (localhost) :
    // on reconstruit l'URL absolue depuis l'hôte public, sinon Next renvoie un
    // Location relatif et www boucle sur lui-même.
    return NextResponse.redirect(
      new URL(`${pathname}${search}`, `https://${APEX}`),
      301,
    );
  }

  if (pathname === "/v5" || pathname === "/v5/" || pathname.startsWith("/v5/")) {
    return NextResponse.redirect(canonical(origin, "/"), 301);
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    const clean = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(canonical(origin, clean, search), 308);
  }

  // Le back office est servi par une rewrite externe : les en-têtes déclarés
  // dans `next.config.ts` ne s'appliquent pas à la réponse qui vient de FastAPI.
  // On les pose donc ici, sur la réponse de Next, pour que `noindex` survive.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
