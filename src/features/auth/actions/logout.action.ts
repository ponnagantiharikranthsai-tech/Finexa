"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  try {
    const cookieStore = await cookies();
    cookieStore.delete("finexa_session");
    cookieStore.delete("finexa_user_email");
  } catch (e) {}
}
