"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
