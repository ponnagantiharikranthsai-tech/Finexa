import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, internal routes, public API endpoints, etc.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
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
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));

  if (!hasAuthCookie && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let user = null;
  if (hasAuthCookie) {
    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      user = supabaseUser || null;
    } catch (error) {
      user = null;
    }
  }

  // 2. Unauthenticated user attempting to access a protected page -> Redirect to /login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    return redirectResponse;
  }

  // 3. Authenticated user attempting to access /login or / -> Redirect to /home
  if (user && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c.name, c.value, c));
    return redirectResponse;
  }

  // 4. If user is authenticated, forward x-user-id header while preserving cookies
  if (user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", user.id);
    const finalResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    supabaseResponse.cookies.getAll().forEach((c) => {
      finalResponse.cookies.set(c.name, c.value, c);
    });
    return finalResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
