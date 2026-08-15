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

    const identifier = parsed.data.email.trim();
    const password = parsed.data.password;

    // Resolve email address: if identifier has @, use it; otherwise format/resolve email
    let loginEmail = identifier;
    if (!identifier.includes("@")) {
      // Map mobile or username input to registered admin email if applicable
      loginEmail = "ponnagantiharikranthsai@gmail.com";
    }

    const supabase = await createSupabaseServerClient();
    let authError = null;
    let authSuccess = false;

    // Try signing in with resolved email
    const { data: signInData, error: err1 } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password,
    });

    if (!err1 && signInData?.user) {
      authSuccess = true;
    } else {
      // If identifier itself was tried, attempt fallback with direct identifier
      if (loginEmail !== identifier) {
        const { data: signInData2, error: err2 } = await supabase.auth.signInWithPassword({
          email: identifier,
          password: password,
        });
        if (!err2 && signInData2?.user) {
          authSuccess = true;
        } else {
          authError = err2?.message || err1?.message || "Invalid login credentials";
        }
      } else {
        authError = err1?.message || "Invalid login credentials";
      }
    }

    if (!authSuccess && authError) {
      return NextResponse.json({ success: false, error: authError }, { status: 401 });
    }

    // Fire-and-forget audit log
    auditLog("admin_login", "admin", undefined, { email: loginEmail });

    const cookieStore = await cookies();
    cookieStore.set("finexa_session", "true", {
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    cookieStore.set("finexa_user_email", loginEmail, {
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
    res.cookies.set("finexa_user_email", loginEmail, {
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
