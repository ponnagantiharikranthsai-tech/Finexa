import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuth() {
  // 1. Fast path: middleware stamped x-user-id in request headers
  const headerStore = await headers();
  const userId = headerStore.get("x-user-id");
  if (userId) {
    return { id: userId } as { id: string; [key: string]: unknown };
  }

  // 2. Cookie session fallback: check finexa_session or Supabase auth cookies
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore.has("finexa_session") || 
                           cookieStore.getAll().some(c => c.name.startsWith("sb-") || c.name.includes("auth-token"));
  if (hasSessionCookie) {
    return { id: "authenticated-user" };
  }

  // 3. Fallback: verify with Supabase auth
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
