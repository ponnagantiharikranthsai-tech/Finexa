import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const LOCKDOWN_SQL_STATEMENTS = [
  // 1. Revoke public/anon
  `REVOKE ALL ON TABLE public.borrowers FROM anon;`,
  `REVOKE ALL ON TABLE public.loans FROM anon;`,
  `REVOKE ALL ON TABLE public.penalty_ledger FROM anon;`,
  `REVOKE ALL ON TABLE public.payments FROM anon;`,
  `REVOKE ALL ON TABLE public.loan_applications FROM anon;`,
  `REVOKE ALL ON TABLE public.funders FROM anon;`,
  `REVOKE ALL ON TABLE public.capital_returns FROM anon;`,
  `REVOKE ALL ON TABLE public.loan_cycles FROM anon;`,
  `REVOKE ALL ON TABLE public.payment_reminders FROM anon;`,
  `REVOKE ALL ON TABLE public.admin_notifications FROM anon;`,
  `REVOKE ALL ON TABLE public.completed_notification_keys FROM anon;`,
  `REVOKE ALL ON TABLE public.push_subscriptions FROM anon;`,
  `REVOKE ALL ON TABLE public.pushed_notification_keys FROM anon;`,
  `REVOKE ALL ON TABLE public.audit_log FROM anon;`,
  `REVOKE ALL ON TABLE public.notifications_log FROM anon;`,

  // Revoke authenticated defaults
  `REVOKE ALL ON TABLE public.borrowers FROM authenticated;`,
  `REVOKE ALL ON TABLE public.loans FROM authenticated;`,
  `REVOKE ALL ON TABLE public.penalty_ledger FROM authenticated;`,
  `REVOKE ALL ON TABLE public.payments FROM authenticated;`,
  `REVOKE ALL ON TABLE public.loan_applications FROM authenticated;`,
  `REVOKE ALL ON TABLE public.funders FROM authenticated;`,
  `REVOKE ALL ON TABLE public.capital_returns FROM authenticated;`,
  `REVOKE ALL ON TABLE public.loan_cycles FROM authenticated;`,
  `REVOKE ALL ON TABLE public.payment_reminders FROM authenticated;`,
  `REVOKE ALL ON TABLE public.admin_notifications FROM authenticated;`,
  `REVOKE ALL ON TABLE public.completed_notification_keys FROM authenticated;`,
  `REVOKE ALL ON TABLE public.push_subscriptions FROM authenticated;`,
  `REVOKE ALL ON TABLE public.pushed_notification_keys FROM authenticated;`,
  `REVOKE ALL ON TABLE public.audit_log FROM authenticated;`,
  `REVOKE ALL ON TABLE public.notifications_log FROM authenticated;`,

  // Service role grant
  `GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;`,
  `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;`,
  `GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;`,

  // 2. Enable RLS
  `ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.penalty_ledger ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.funders ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.capital_returns ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.loan_cycles ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.completed_notification_keys ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.pushed_notification_keys ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;`,
  `ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;`,

  // 3. Drop existing policies
  `DO $$ 
  DECLARE 
      r RECORD;
  BEGIN
      FOR r IN (
          SELECT tablename, policyname 
          FROM pg_policies 
          WHERE schemaname = 'public'
      ) LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
      END LOOP;
  END $$;`,

  // 4. Admin function
  `CREATE OR REPLACE FUNCTION public.is_finexa_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, auth
  AS $$
    SELECT COALESCE(
      (auth.jwt() ->> 'email' = 'ponnagantiharikranthsai@gmail.com') OR
      (auth.uid() = 'a2ecd542-4952-48ef-b41b-e56ab7a490b0'::uuid),
      false
    );
  $$;`,

  `REVOKE EXECUTE ON FUNCTION public.is_finexa_admin() FROM PUBLIC;`,
  `REVOKE EXECUTE ON FUNCTION public.is_finexa_admin() FROM anon;`,
  `GRANT EXECUTE ON FUNCTION public.is_finexa_admin() TO authenticated;`,
  `GRANT EXECUTE ON FUNCTION public.is_finexa_admin() TO service_role;`,

  // 5. Grant authenticated
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.borrowers TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loans TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.penalty_ledger TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loan_applications TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.funders TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.capital_returns TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.loan_cycles TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_reminders TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_notifications TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.completed_notification_keys TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pushed_notification_keys TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log TO authenticated;`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications_log TO authenticated;`,

  // 6. Strict policies
  `CREATE POLICY "admin_all_borrowers" ON public.borrowers FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_loans" ON public.loans FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_penalty_ledger" ON public.penalty_ledger FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_payments" ON public.payments FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_loan_applications" ON public.loan_applications FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_funders" ON public.funders FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_capital_returns" ON public.capital_returns FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_loan_cycles" ON public.loan_cycles FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_payment_reminders" ON public.payment_reminders FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_admin_notifications" ON public.admin_notifications FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_completed_notification_keys" ON public.completed_notification_keys FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_push_subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_pushed_notification_keys" ON public.pushed_notification_keys FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_audit_log" ON public.audit_log FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`,
  `CREATE POLICY "admin_all_notifications_log" ON public.notifications_log FOR ALL TO authenticated USING (public.is_finexa_admin()) WITH CHECK (public.is_finexa_admin());`
];

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || request.headers.get("x-lockdown-key");

    // Must provide either the cron secret or the encryption key or run in trusted environment
    const trustedKey = process.env.CRON_SECRET || process.env.ENCRYPTION_KEY;
    if (process.env.NODE_ENV === "production" && key !== trustedKey) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const results: Array<{ stmt: string; status: "success" | "error"; error?: string }> = [];

    for (const stmt of LOCKDOWN_SQL_STATEMENTS) {
      try {
        await db.execute(sql.raw(stmt));
        results.push({ stmt: stmt.slice(0, 60), status: "success" });
      } catch (err: any) {
        results.push({ stmt: stmt.slice(0, 60), status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: "FINEXA Database Security Lockdown executed successfully.",
      totalStatements: LOCKDOWN_SQL_STATEMENTS.length,
      results
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
