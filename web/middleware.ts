import { NextResponse, type NextRequest } from "next/server";

const APEX = "sujeedesign.com";

/**
 * Un seul hôte public : l'apex. `www` redirige en 301 pour éviter que le même
 * contenu soit servi sur deux hôtes.
 */
export function middleware(request: NextRequest): NextResponse {
  const [host = ""] = (request.headers.get("host") ?? "").split(":");
  if (host.toLowerCase() === `www.${APEX}`) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = APEX;
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
