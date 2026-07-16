import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { loanApplicationsTable } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Mask connection string for safety
  const rawUrl = process.env.DATABASE_URL || "";
  let maskedUrl = "NOT_SET";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      parsed.password = "****";
      maskedUrl = parsed.toString();
    } catch {
      maskedUrl = "INVALID_URL_FORMAT";
    }
  }

  try {
    const res = await db
      .select()
      .from(loanApplicationsTable)
      .limit(1);
    
    return NextResponse.json({
      success: true,
      databaseUrl: maskedUrl,
      message: "Database connection works perfectly!",
      data: res
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      databaseUrl: maskedUrl,
      message: err.message || "Query failed",
      name: err.name,
      cause: err.cause ? {
        message: err.cause.message,
        code: err.cause.code
      } : null
    }, { status: 500 });
  }
}
