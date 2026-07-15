"use server";

import { borrowerRepository } from "../repository/borrower.repository";
import { requireAuth } from "@/lib/auth";
import type { ActionResult, PaginatedResult } from "@/types/api.types";
import type { Borrower } from "@/db/schema";

export async function getBorrowersAction(
  search?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ActionResult<PaginatedResult<Borrower>>> {
  try {
    await requireAuth();
    const result = await borrowerRepository.findMany({ search }, { page, pageSize });
    return { success: true, data: result };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch borrowers" };
  }
}
