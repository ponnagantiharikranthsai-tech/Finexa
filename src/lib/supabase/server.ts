import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
