import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { loanApplicationsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    console.log("Running debug query...");
    const res = await db
      .select()
      .from(loanApplicationsTable)
      .limit(1);
    
    return NextResponse.json({
      success: true,
      message: "Query succeeded!",
      data: res
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err.message || "Query failed",
      name: err.name,
      query: err.query,
      params: err.params,
      // Print detailed Postgres error fields if available
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      severity: err.severity,
      stack: err.stack,
      cause: err.cause ? {
        message: err.cause.message,
        code: err.cause.code,
        stack: err.cause.stack
      } : null
    }, { status: 500 });
  }
}
