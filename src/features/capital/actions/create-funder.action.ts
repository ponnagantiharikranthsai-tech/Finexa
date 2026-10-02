"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { safeRevalidatePath } from "@/lib/safe-revalidate";
import { auditLog } from "@/lib/audit-log";

export interface CreateFunderInput {
  name: string;
  mobile: string;
  address?: string;
  capitalAmount?: number | string;
  fundingModel?: string;
  notes?: string | null;
}

export async function createFunderAction(
  prevStateOrData: any,
  maybeFormData?: FormData
) {
  try {
    await requireAuth();

    let name: string = "";
    let mobile: string = "";
    let address: string = "";
    let capitalAmountStr: string = "0";
    let fundingModel: string = "on_demand";
    let notes: string | null = null;

    if (maybeFormData instanceof FormData) {
      name = (maybeFormData.get("name") as string) || "";
      mobile = (maybeFormData.get("mobile") as string) || "";
      address = (maybeFormData.get("address") as string) || "";
      capitalAmountStr = (maybeFormData.get("capitalAmount") as string) || "0";
      fundingModel = (maybeFormData.get("fundingModel") as string) || "on_demand";
      notes = (maybeFormData.get("notes") as string) || null;
    } else if (prevStateOrData instanceof FormData) {
      name = (prevStateOrData.get("name") as string) || "";
      mobile = (prevStateOrData.get("mobile") as string) || "";
      address = (prevStateOrData.get("address") as string) || "";
      capitalAmountStr = (prevStateOrData.get("capitalAmount") as string) || "0";
      fundingModel = (prevStateOrData.get("fundingModel") as string) || "on_demand";
      notes = (prevStateOrData.get("notes") as string) || null;
    } else if (typeof prevStateOrData === "object" && prevStateOrData !== null) {
      name = prevStateOrData.name || "";
      mobile = prevStateOrData.mobile || "";
      address = prevStateOrData.address || "";
      capitalAmountStr = String(prevStateOrData.capitalAmount ?? "0");
      fundingModel = prevStateOrData.fundingModel || "on_demand";
      notes = prevStateOrData.notes || null;
    } else {
      return { success: false, error: "Invalid form data provided." };
    }

    name = name.trim();
    mobile = mobile.trim();

    if (!name) {
      return { success: false, error: "Capital Person Name is required." };
    }
    if (!mobile) {
      return { success: false, error: "Mobile number is required." };
    }

    const initialAmount = Number(capitalAmountStr) || 0;
    const todayStr = new Date().toISOString().split("T")[0]!;

    // Check if an existing funder shares this mobile number
    const existingFunder = await capitalRepository.findFunderByMobile(mobile);

    if (existingFunder) {
      // If capital person already exists, optionally record received capital if specified
      if (initialAmount > 0) {
        await capitalRepository.createFundingTransaction({
          transactionCode: await capitalRepository.getNextTransactionCode(),
          funderId: existingFunder.funderId,
          amount: initialAmount.toFixed(2),
          fundingDate: todayStr,
          status: "received",
          notes: notes || "Received capital",
        });
      }

      safeRevalidatePath("/capital-management");
      return {
        success: true,
        data: existingFunder,
        message: `Existing Capital Person found (${existingFunder.name}). Ready for On-Demand funding!`,
      };
    }

    // Create On-Demand Capital Person
    const funder = await capitalRepository.createFunder({
      name,
      mobile,
      address: address || "",
      capitalAmount: "0.00",
      investmentDate: todayStr,
      returnDueDate: null,
      status: "active",
      fundingModel: "on_demand",
      notes: notes || null,
    });

    // If initial received amount was specified, record a received funding transaction
    if (initialAmount > 0) {
      await capitalRepository.createFundingTransaction({
        transactionCode: await capitalRepository.getNextTransactionCode(),
        funderId: funder.funderId,
        amount: initialAmount.toFixed(2),
        fundingDate: todayStr,
        status: "received",
        notes: notes || "Initial capital received",
      });
    }

    await auditLog("funder_created", "funder", funder.funderId, {
      name: funder.name,
      mobile: funder.mobile,
      fundingModel: "on_demand",
    });

    safeRevalidatePath("/capital-management");

    return {
      success: true,
      data: funder,
      message: `Capital Person "${funder.name}" created successfully as On-Demand funding source!`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to create capital person profile.",
    };
  }
}
