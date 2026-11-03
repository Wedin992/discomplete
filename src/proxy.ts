import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

// The address people should always end up on. Preview deployments keep their own URLs.
const CANONICAL_HOST = "www.discomplete.com";
const REDIRECT_HOSTS = new Set(["discomplete.vercel.app", "discomplete.com"]);

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  if (REDIRECT_HOSTS.has(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Refreshes the session cookie when needed and verifies it. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims?.sub;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const res = NextResponse.redirect(url);
    // An invite link opened while signed out: come back to it after signing in.
    if (/^\/parties\/join\/[a-z0-9]{6,40}$/i.test(path)) res.cookies.set("dc_next", path, { maxAge: 86400, path: "/", sameSite: "lax" });
    return res;
  }
  const next = request.cookies.get("dc_next")?.value;
  if (signedIn && path === "/" && next && /^\/parties\/join\/[a-z0-9]{6,40}$/i.test(next)) {
    const url = request.nextUrl.clone();
    url.pathname = next;
    url.search = "";
    const res = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) res.cookies.set(c);
    res.cookies.delete("dc_next");
    return res;
  }
  return response;
}

export const config = {
  // Static files (icons, manifest, service worker, offline page) skip the session check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
