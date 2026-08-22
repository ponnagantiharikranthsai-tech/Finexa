import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, internal routes, public API endpoints, PWA files, icons
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables missing in middleware!");
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isPublicPath = pathname === "/" || pathname === "/login" || pathname.startsWith("/apply/");

  const hasFinexaSession = request.cookies.has("finexa_session") && request.cookies.get("finexa_session")?.value === "true";
  let isSessionValid = hasFinexaSession;
  let user: { id: string; [key: string]: unknown } | null = hasFinexaSession ? { id: "finexa-admin-user" } : null;

  // Non-blocking network check: Max 1200ms timeout for cloud auth check to prevent 15s freezes on PWA startup
  if (!isSessionValid) {
    try {
      const authPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
        setTimeout(() => resolve({ data: { user: null } }), 1200)
      );

      const res = await Promise.race([authPromise, timeoutPromise]);
      const supabaseUser = res.data?.user;
      user = (supabaseUser as any) || null;
      if (user) {
        isSessionValid = true;
      }
    } catch (error) {
      user = null;
    }
  }

  // 2. Unauthenticated user attempting to access ANY protected page -> Redirect to /login
  if (!isSessionValid && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    redirectResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    return redirectResponse;
  }

  // 3. Authenticated user attempting to access /login or / -> Redirect to /home
  if (isSessionValid && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    const redirectResponse = NextResponse.redirect(url);
    redirectResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    redirectResponse.headers.set("Pragma", "no-cache");
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    return redirectResponse;
  }

  // 4. Forward authenticated request with security and zero-cache headers
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set("x-user-id", user.id);
  }

  const finalResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  finalResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  finalResponse.headers.set("Pragma", "no-cache");
  finalResponse.headers.set("X-Content-Type-Options", "nosniff");
  finalResponse.headers.set("X-Frame-Options", "DENY");
  return finalResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
