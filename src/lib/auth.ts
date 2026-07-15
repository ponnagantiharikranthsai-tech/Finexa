import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireAuth() {
  const supabase = await createSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  const user = session?.user;

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
