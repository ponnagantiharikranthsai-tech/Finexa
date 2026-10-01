"use server";

import { requireAuth } from "@/lib/auth";
import { capitalRepository } from "../repository/capital.repository";
import { revalidatePath } from "next/cache";
import { auditLog } from "@/lib/audit-log";

export interface CreateFunderInput {
  name: string;
  mobile: string;
  address: string;
  capitalAmount: number | string;
  investmentDate: string;
  returnDueDate: string;
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
    let capitalAmountStr: string = "";
    let investmentDate: string = "";
    let returnDueDate: string = "";
    let notes: string | null = null;

    if (maybeFormData instanceof FormData) {
      name = (maybeFormData.get("name") as string) || "";
      mobile = (maybeFormData.get("mobile") as string) || "";
      address = (maybeFormData.get("address") as string) || "";
      capitalAmountStr = (maybeFormData.get("capitalAmount") as string) || "";
      investmentDate = (maybeFormData.get("investmentDate") as string) || "";
      returnDueDate = (maybeFormData.get("returnDueDate") as string) || "";
      notes = (maybeFormData.get("notes") as string) || null;
    } else if (prevStateOrData instanceof FormData) {
      name = (prevStateOrData.get("name") as string) || "";
      mobile = (prevStateOrData.get("mobile") as string) || "";
      address = (prevStateOrData.get("address") as string) || "";
      capitalAmountStr = (prevStateOrData.get("capitalAmount") as string) || "";
      investmentDate = (prevStateOrData.get("investmentDate") as string) || "";
      returnDueDate = (prevStateOrData.get("returnDueDate") as string) || "";
      notes = (prevStateOrData.get("notes") as string) || null;
    } else if (typeof prevStateOrData === "object" && prevStateOrData !== null) {
      name = prevStateOrData.name || "";
      mobile = prevStateOrData.mobile || "";
      address = prevStateOrData.address || "";
      capitalAmountStr = String(prevStateOrData.capitalAmount || "");
      investmentDate = prevStateOrData.investmentDate || "";
      returnDueDate = prevStateOrData.returnDueDate || "";
      notes = prevStateOrData.notes || null;
    } else {
      return { success: false, error: "Invalid form data provided." };
    }

    if (!name || !mobile || !address || !capitalAmountStr || !investmentDate || !returnDueDate) {
      return { success: false, error: "All required fields must be filled out." };
    }

    const capitalAmount = Number(capitalAmountStr);
    if (isNaN(capitalAmount) || capitalAmount <= 0) {
      return { success: false, error: "Capital amount must be a positive number." };
    }

    // Check if an existing funder shares this mobile number
    const existingFunder = await capitalRepository.findFunderByMobile(mobile);

    // Create a new individual investment record under this funder
    const funder = await capitalRepository.createFunder({
      name: existingFunder ? existingFunder.name : name,
      mobile,
      address: existingFunder ? existingFunder.address : address,
      capitalAmount: capitalAmount.toFixed(2),
      investmentDate,
      returnDueDate,
      status: "active",
      notes: notes || null,
    });

    await auditLog("funder_created", "funder", funder.funderId, {
      name: funder.name,
      mobile: funder.mobile,
      isAdditionalInvestment: Boolean(existingFunder),
    });

    revalidatePath("/capital-management");

    return {
      success: true,
      data: funder,
      message: existingFunder
        ? `Existing funder found (${existingFunder.name}). New investment of ₹${capitalAmount.toLocaleString("en-IN")} added successfully!`
        : `Funder registered and investment of ₹${capitalAmount.toLocaleString("en-IN")} created successfully!`,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || "Failed to create funder investment profile." };
  }
}
