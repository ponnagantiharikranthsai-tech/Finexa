"use server";

import { loginSchema } from "../schemas/login.schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit-log";
import type { ActionResult } from "@/types/api.types";

export async function loginAction(
  _prevState: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  try {
    const raw = Object.fromEntries(formData);
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      parsed.error.issues.forEach((err) => {
        const path = err.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(err.message);
      });
      return { success: false, error: fieldErrors };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await auditLog("admin_login", "admin", undefined, { email: parsed.data.email });

    return { success: true, data: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to log in" };
  }
}
