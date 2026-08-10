import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const isDev = process.env.NODE_ENV !== "production";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = (isDev && process.env.DEV_SUPABASE_URL) ? process.env.DEV_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = (isDev && process.env.DEV_SUPABASE_ANON_KEY) ? process.env.DEV_SUPABASE_ANON_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables. Please verify that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.");
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // Can be safely ignored if middleware refreshes user sessions.
          }
        },
      },
    }
  );
}
