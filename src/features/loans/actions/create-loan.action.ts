"use server";

import { createLoanSchema } from "../schemas/create-loan.schema";
import { loanRepository } from "../repository/loan.repository";
import { borrowerRepository } from "@/features/borrowers/repository/borrower.repository";
import { emailService } from "@/services/email/email.service";
import { notificationLogRepository } from "@/features/notifications/repository/notification-log.repository";
import { calculateMonthlyInterest } from "@/domain/interest-calculator";
import { calculateDueDate } from "@/domain/due-date-calculator";
import { encrypt } from "@/lib/encryption";
import { auditLog } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";
import type { ActionResult } from "@/types/api.types";

export async function createLoanAction(
  _prevState: ActionResult<{ loanId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ loanId: string }>> {
  try {
    await requireAuth();

    const raw = Object.fromEntries(formData);
    const parsed = createLoanSchema.safeParse(raw);
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

    let bId = parsed.data.borrowerId;

    if (!bId) {
      if (!parsed.data.borrowerName || !parsed.data.mobile || !parsed.data.email || !parsed.data.pan || !parsed.data.aadhaar) {
        return { success: false, error: "Borrower details are required to create a new borrower inline." };
      }

      // 1. Check if borrower with exact same name AND mobile exists
      const existingB = await borrowerRepository.findMatchingBorrower(parsed.data.borrowerName, parsed.data.mobile);
      if (existingB) {
        bId = existingB.borrowerId;
      } else {
        // 2. Different name or new borrower: get unique mobile to prevent unique constraint error
        const uniqueMobile = await borrowerRepository.getUniqueMobileNumber(parsed.data.mobile);
        const panEnc = encrypt(parsed.data.pan);
        const aadhaarEnc = encrypt(parsed.data.aadhaar);

        const newB = await borrowerRepository.create({
          name: parsed.data.borrowerName,
          mobile: uniqueMobile,
          email: parsed.data.email,
          panEncrypted: panEnc,
          aadhaarEncrypted: aadhaarEnc,
          locationUrl: parsed.data.locationUrl || null,
        });
        bId = newB.borrowerId;
        await auditLog("borrower_created", "borrower", bId, { name: newB.name, mobile: newB.mobile });
      }
    }

    const borrowerObj = await borrowerRepository.findById(bId);
    if (!borrowerObj) {
      return { success: false, error: "Borrower not found." };
    }

    const dueDateStr = parsed.data.dueDate;

    const monthlyInterest = calculateMonthlyInterest(parsed.data.principal, parsed.data.interestRate);

    const loan = await loanRepository.create({
      borrowerId: bId,
      principal: parsed.data.principal.toString(),
      interestType: parsed.data.interestType,
      interestRate: parsed.data.interestRate.toString(),
      dateGiven: parsed.data.dateGiven,
      dueDate: dueDateStr,
      status: "active",
      penaltyAmount: "0",
    });

    if (borrowerObj.email) {
      try {
        await emailService.sendLoanCreatedEmail({
          loanId: loan.loanId,
          borrowerName: borrowerObj.name,
          borrowerEmail: borrowerObj.email,
          principal: Number(loan.principal),
          monthlyInterest,
          interestRate: Number(loan.interestRate),
          dateGiven: loan.dateGiven,
          dueDate: loan.dueDate,
        });

        await notificationLogRepository.insert({
          loanId: loan.loanId,
          channel: "email",
          type: "creation",
          status: "sent",
        });
      } catch (e: any) {
        await notificationLogRepository.insert({
          loanId: loan.loanId,
          channel: "email",
          type: "creation",
          status: "failed",
          errorMessage: e.message || "Failed to send email notification",
        });
      }
    }

    await auditLog("loan_created", "loan", loan.loanId, { principal: loan.principal });

    return { success: true, data: { loanId: loan.loanId } };
  } catch (err: any) {
    if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("createLoanAction Error:", err);
    return { success: false, error: typeof err === "string" ? err : err.message || "Failed to create loan" };
  }
}
