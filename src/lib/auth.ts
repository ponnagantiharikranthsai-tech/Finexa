import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuth() {
  // Fast path: middleware already verified the user and stamped their ID in the header.
  // No Supabase network call needed — saves 50–120ms per action.
  const headerStore = await headers();
  const userId = headerStore.get("x-user-id");
  if (userId) {
    return { id: userId } as { id: string; [key: string]: unknown };
  }

  // Fallback: middleware wasn't involved (e.g. direct API access), verify with Supabase.
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
