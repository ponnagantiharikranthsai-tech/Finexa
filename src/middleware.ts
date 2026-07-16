import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  // Fast path: skip Supabase auth call for clearly public routes
  const isPublicPath = pathname === "/" || pathname === "/login" || pathname.startsWith("/apply/");
  if (isPublicPath) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Supabase environment variables are missing in middleware!");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          const isDev = process.env.NODE_ENV === "development";
          const cookieOptions = {
            ...options,
            secure: isDev ? false : options.secure,
          };
          request.cookies.set({ name, value, ...cookieOptions });
          response = NextResponse.next({
            request,
          });
          response.cookies.set({ name, value, ...cookieOptions });
        },
        remove(name: string, options: any) {
          const isDev = process.env.NODE_ENV === "development";
          const cookieOptions = {
            ...options,
            secure: isDev ? false : options.secure,
          };
          request.cookies.delete({ name, ...cookieOptions });
          response = NextResponse.next({
            request,
          });
          response.cookies.delete({ name, ...cookieOptions });
        },
      },
    }
  );

  let user = null;
  try {
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    user = supabaseUser || null;
  } catch (error) {
    // Cookie is invalid or expired
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // Stamp verified user ID into request header so Server Actions skip re-auth
  response.headers.set("x-user-id", user.id);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
