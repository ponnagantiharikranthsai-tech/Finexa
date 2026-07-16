import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables in Vercel. Please verify that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured in your Vercel Project Settings.");
  }

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            const isDev = process.env.NODE_ENV === "development";
            cookieStore.set({
              name,
              value,
              ...options,
              secure: isDev ? false : options.secure,
            });
          } catch (error) {
            // Can be ignored if called from Server Component
          }
        },
        remove(name: string, options: any) {
          try {
            const isDev = process.env.NODE_ENV === "development";
            cookieStore.set({
              name,
              value: "",
              ...options,
              secure: isDev ? false : options.secure,
            });
          } catch (error) {
            // Can be ignored if called from Server Component
          }
        },
      },
    }
  );
}
