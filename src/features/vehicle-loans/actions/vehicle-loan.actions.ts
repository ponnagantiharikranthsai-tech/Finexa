"use server";

import { revalidatePath } from "next/cache";
import { 
  getAllVehicleLoans, 
  getVehicleLoanByCode, 
  createVehicleLoanInDb, 
  updateVehicleLoanStatus 
} from "../repository/vehicle-loan.repository";
import { VehicleCollateralLoanData, VehicleLoanStatus, SettlementNoticePayload } from "../types/vehicle-loan.types";
import { smsService } from "@/services/sms/sms.service";

/**
 * Fetch all vehicle collateral loans
 */
export async function fetchVehicleLoansAction(): Promise<{ success: boolean; data: VehicleCollateralLoanData[]; error?: string }> {
  try {
    const data = await getAllVehicleLoans();
    return { success: true, data };
  } catch (err: any) {
    console.error("[fetchVehicleLoansAction] Error:", err);
    return { success: false, data: [], error: err.message || "Failed to fetch vehicle loans" };
  }
}

/**
 * Get single vehicle loan by application code
 */
export async function getVehicleLoanDetailAction(code: string): Promise<{ success: boolean; data: VehicleCollateralLoanData | null; error?: string }> {
  try {
    const data = await getVehicleLoanByCode(code);
    return { success: true, data };
  } catch (err: any) {
    console.error("[getVehicleLoanDetailAction] Error:", err);
    return { success: false, data: null, error: err.message || "Failed to fetch loan details" };
  }
}

/**
 * Create new vehicle collateral loan in Supabase digital ledger
 */
export async function createVehicleLoanAction(
  formData: Partial<VehicleCollateralLoanData>
): Promise<{ success: boolean; data?: VehicleCollateralLoanData; error?: string }> {
  try {
    const created = await createVehicleLoanInDb(formData);
    revalidatePath("/vehicle-loans");
    return { success: true, data: created };
  } catch (err: any) {
    console.error("[createVehicleLoanAction] Error:", err);
    return { success: false, error: err.message || "Failed to create vehicle loan" };
  }
}

/**
 * Update vehicle loan status (e.g., active_in_yard -> pending_settlement / settled_released)
 */
export async function updateVehicleLoanStatusAction(
  applicationCode: string,
  status: VehicleLoanStatus,
  options?: { settlementNoticeSent?: boolean; notes?: string }
): Promise<{ success: boolean; data?: VehicleCollateralLoanData | null; error?: string }> {
  try {
    const updated = await updateVehicleLoanStatus(applicationCode, status, options);
    revalidatePath("/vehicle-loans");
    return { success: true, data: updated };
  } catch (err: any) {
    console.error("[updateVehicleLoanStatusAction] Error:", err);
    return { success: false, error: err.message || "Failed to update vehicle loan status" };
  }
}

/**
 * Trigger SMS / WhatsApp settlement notice for ₹35,000
 */
export async function sendSettlementNoticeAction(
  payload: SettlementNoticePayload
): Promise<{ 
  success: boolean; 
  smsSent: boolean; 
  whatsappUrl: string; 
  noticeText: string; 
  error?: string 
}> {
  try {
    const noticeText = 
      `🚨 *FINEXA - VEHICLE COLLATERAL SETTLEMENT NOTICE*\n\n` +
      `Dear ${payload.borrowerName},\n` +
      `Your Vehicle Collateral Loan (*${payload.applicationCode}*) for vehicle *${payload.vehicleMakeModel}* (Reg: *${payload.vehicleRegNumber}*) is due on *${payload.dueDate}*.\n\n` +
      `💰 *Total Amount Payable:* ₹${payload.totalAmountPayable.toLocaleString("en-IN")}\n` +
      `📍 *Vehicle Custody:* Finexa Secured Yard\n` +
      `👤 *Lender Contact:* ${payload.lenderName} (${payload.lenderContact})\n\n` +
      `Please clear the settlement of ₹${payload.totalAmountPayable.toLocaleString("en-IN")} on or before the due date to collect your vehicle and original RC/RTO documents.\n` +
      `_Note: Delay beyond the due date activates vehicle custody liquidation clauses under signed Form 29 & 30._`;

    // WhatsApp direct click URL
    const cleanPhone = payload.borrowerContact.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(noticeText)}`;

    // Attempt Fast2SMS if available
    let smsSent = false;
    try {
      if (cleanPhone.length === 10 && process.env.FAST2SMS_API_KEY) {
        const smsResult = await smsService.sendSMS(
          cleanPhone, 
          `FINEXA Notice: Loan ${payload.applicationCode} for ${payload.vehicleRegNumber} is due on ${payload.dueDate}. Amount: Rs.${payload.totalAmountPayable}. Pay to release vehicle. Contact: ${payload.lenderContact}`
        );
        smsSent = smsResult.success;
      }
    } catch (e) {
      console.warn("[sendSettlementNoticeAction] SMS service dispatch notice:", e);
    }

    // Update notice timestamp in DB
    await updateVehicleLoanStatus(payload.applicationCode, "pending_settlement", { settlementNoticeSent: true });
    revalidatePath("/vehicle-loans");

    return {
      success: true,
      smsSent,
      whatsappUrl,
      noticeText,
    };
  } catch (err: any) {
    console.error("[sendSettlementNoticeAction] Error:", err);
    return {
      success: false,
      smsSent: false,
      whatsappUrl: "",
      noticeText: "",
      error: err.message || "Failed to prepare settlement notice",
    };
  }
}
