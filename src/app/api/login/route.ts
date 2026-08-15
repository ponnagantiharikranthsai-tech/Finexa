import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginSchema } from "@/features/auth/schemas/login.schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit-log";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
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
      return NextResponse.json({ success: false, error: fieldErrors }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }

    // Fire-and-forget audit log
    auditLog("admin_login", "admin", undefined, { email: parsed.data.email });

    const cookieStore = await cookies();
    cookieStore.set("finexa_session", "true", {
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    cookieStore.set("finexa_user_email", parsed.data.email, {
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    });

    const res = NextResponse.json({ success: true, data: null });
    res.cookies.set("finexa_session", "true", {
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set("finexa_user_email", parsed.data.email, {
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to log in" }, { status: 500 });
  }
}
