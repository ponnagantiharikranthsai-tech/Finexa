"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { vehicleCollateralLoansTable } from "@/db/schema/vehicle-loans";
import { eq } from "drizzle-orm";
import { ensureVehicleLoansTableStructure, getVehicleLoanByCode } from "../repository/vehicle-loan.repository";
import { VehicleCollateralLoanData } from "../types/vehicle-loan.types";

export interface VehicleBorrowerSubmissionPayload {
  applicationCode: string;
  borrowerName: string;
  borrowerContact: string;
  borrowerAddress: string;
  fatherName?: string;
  fatherContact?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  hospitalPurposeNote?: string;
  termsAccepted: boolean;
  custodyConfirmed: boolean;
  signatureName: string;
}

export async function submitVehicleBorrowerApplicationAction(
  payload: VehicleBorrowerSubmissionPayload
): Promise<{ success: boolean; data?: VehicleCollateralLoanData; error?: string }> {
  try {
    await ensureVehicleLoansTableStructure();

    const existing = await getVehicleLoanByCode(payload.applicationCode);
    if (!existing) {
      return { success: false, error: "Application code not found." };
    }

    if (!payload.termsAccepted || !payload.custodyConfirmed) {
      return { success: false, error: "You must accept the legal pledge terms and confirm yard custody." };
    }

    const updatedNotes = 
      `${existing.notes || ""}\n[Borrower Submitted]: KYC verified by ${payload.borrowerName}. ` +
      `Father: ${payload.fatherName || "N/A"} (${payload.fatherContact || "N/A"}). ` +
      `Aadhaar: ${payload.aadhaarNumber || "N/A"}. PAN: ${payload.panNumber || "N/A"}. ` +
      `Hospital Note: ${payload.hospitalPurposeNote || "Emergency hospital purpose"}. ` +
      `E-Signed by ${payload.signatureName} at ${new Date().toISOString()}`;

    const [updated] = await db
      .update(vehicleCollateralLoansTable)
      .set({
        borrowerName: payload.borrowerName,
        borrowerContact: payload.borrowerContact,
        borrowerAddress: payload.borrowerAddress,
        status: "active_in_yard",
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(vehicleCollateralLoansTable.applicationCode, payload.applicationCode))
      .returning();

    revalidatePath("/vehicle-loans");
    revalidatePath(`/apply/vehicle/${payload.applicationCode}`);

    return {
      success: true,
      data: updated as any,
    };
  } catch (err: any) {
    console.error("[submitVehicleBorrowerApplicationAction] Error:", err);
    return {
      success: false,
      error: err.message || "Failed to submit borrower application",
    };
  }
}
