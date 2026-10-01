import { db } from "@/db/client";
import { vehicleCollateralLoansTable, type VehicleCollateralLoan, type InsertVehicleCollateralLoan } from "@/db/schema/vehicle-loans";
import { eq, desc } from "drizzle-orm";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { VehicleCollateralLoanData, VehicleLoanStatus } from "../types/vehicle-loan.types";
import { DEFAULT_VEHICLE_LOAN } from "../schemas/vehicle-loan.schema";

let isTableStructureEnsured = false;

/**
 * Auto-ensures the `vehicle_collateral_loans` table exists in Supabase PostgreSQL
 */
export async function ensureVehicleLoansTableStructure(): Promise<void> {
  if (isTableStructureEnsured) return;
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS vehicle_collateral_loans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_code TEXT UNIQUE,
        loan_type TEXT NOT NULL DEFAULT 'Vehicle Collateral Loan (Emergency/Hospital Purpose)',
        principal_amount NUMERIC(12, 2) NOT NULL DEFAULT 28000.00,
        total_amount_payable NUMERIC(12, 2) NOT NULL DEFAULT 35000.00,
        interest_or_fee NUMERIC(12, 2) NOT NULL DEFAULT 7000.00,
        loan_duration TEXT NOT NULL DEFAULT '1 Month',
        start_date DATE NOT NULL DEFAULT CURRENT_DATE,
        due_date DATE NOT NULL,
        lender_name TEXT NOT NULL DEFAULT 'Hari Kranth Sai',
        lender_contact TEXT NOT NULL DEFAULT '6304228363',
        borrower_name TEXT NOT NULL DEFAULT 'Kuppili Abhilash',
        borrower_contact TEXT DEFAULT '9876543210',
        borrower_address TEXT DEFAULT 'Visakhapatnam, Andhra Pradesh',
        registered_owner TEXT NOT NULL DEFAULT 'Golla Ramu',
        vehicle_make_model TEXT NOT NULL DEFAULT 'Honda Dio (Drum Variant, BS-VI)',
        vehicle_reg_number TEXT NOT NULL DEFAULT 'AP39QY9367',
        engine_number TEXT NOT NULL DEFAULT 'JF98EW0193408',
        chassis_number TEXT NOT NULL DEFAULT 'ME4JF983GNW095191',
        vehicle_color TEXT DEFAULT 'Matte Axis Grey / Sports Yellow',
        fuel_type TEXT DEFAULT 'Petrol',
        collateral_status TEXT NOT NULL DEFAULT 'physical_possession_yard',
        yard_location TEXT NOT NULL DEFAULT 'Finexa Secured Compound / Yard Bay #3',
        yard_in_date DATE DEFAULT CURRENT_DATE,
        odometer_reading NUMERIC(10, 1) DEFAULT 14250.0,
        key_handed_over BOOLEAN NOT NULL DEFAULT true,
        documents_collected JSONB NOT NULL DEFAULT '["Original Smart Card RC", "Signed RTO Form 29 & Form 30", "Signed Security Cheque(s)"]'::jsonb,
        status TEXT NOT NULL DEFAULT 'active_in_yard',
        settlement_notice_sent_at TIMESTAMPTZ,
        settlement_amount_paid NUMERIC(12, 2) DEFAULT 0.00,
        settled_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_vcl_code ON vehicle_collateral_loans(application_code);
      CREATE INDEX IF NOT EXISTS idx_vcl_reg ON vehicle_collateral_loans(vehicle_reg_number);
    `;
    await (db as any).execute(ddl);
    isTableStructureEnsured = true;
  } catch (err) {
    console.warn("[vehicleLoanRepository] Table structure check notice:", err);
  }
}

/**
 * Standard Supabase JS Client Browser Query Helper
 */
export async function fetchVehicleLoanViaSupabaseClient(applicationCode: string): Promise<VehicleCollateralLoanData | null> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("vehicle_collateral_loans")
      .select("*")
      .eq("application_code", applicationCode)
      .single();

    if (error || !data) {
      return null;
    }

    return mapDbRowToModel(data);
  } catch (err) {
    console.error("[SupabaseClient] Error fetching vehicle loan:", err);
    return null;
  }
}

/**
 * Get all vehicle collateral loans
 */
export async function getAllVehicleLoans(): Promise<VehicleCollateralLoanData[]> {
  try {
    await ensureVehicleLoansTableStructure();

    const rows = await db
      .select()
      .from(vehicleCollateralLoansTable)
      .orderBy(desc(vehicleCollateralLoansTable.createdAt));

    if (rows.length === 0) {
      // Seed default record
      const seeded = await seedDefaultVehicleLoan();
      return seeded ? [seeded] : [];
    }

    return rows.map(mapDbRecordToModel);
  } catch (err) {
    console.warn("[vehicleLoanRepository] Fallback to default in-memory loan:", err);
    return [mapFormDataToModel(DEFAULT_VEHICLE_LOAN)];
  }
}

/**
 * Get vehicle loan by application code
 */
export async function getVehicleLoanByCode(code: string): Promise<VehicleCollateralLoanData | null> {
  try {
    await ensureVehicleLoansTableStructure();

    const rows = await db
      .select()
      .from(vehicleCollateralLoansTable)
      .where(eq(vehicleCollateralLoansTable.applicationCode, code))
      .limit(1);

    if (rows.length > 0) {
      return mapDbRecordToModel(rows[0]);
    }

    if (code === DEFAULT_VEHICLE_LOAN.applicationCode) {
      return mapFormDataToModel(DEFAULT_VEHICLE_LOAN);
    }

    return null;
  } catch (err) {
    console.error("[vehicleLoanRepository] Error fetching loan by code:", err);
    if (code === DEFAULT_VEHICLE_LOAN.applicationCode) {
      return mapFormDataToModel(DEFAULT_VEHICLE_LOAN);
    }
    return null;
  }
}

/**
 * Create or save new vehicle loan into Supabase PostgreSQL ledger
 */
export async function createVehicleLoanInDb(data: Partial<VehicleCollateralLoanData>): Promise<VehicleCollateralLoanData> {
  await ensureVehicleLoansTableStructure();

  const insertData: InsertVehicleCollateralLoan = {
    applicationCode: data.applicationCode || `LN-${new Date().getFullYear()}-VCL${Math.floor(Math.random() * 900 + 100)}`,
    loanType: data.loanType || "Vehicle Collateral Loan (Emergency/Hospital Purpose)",
    principalAmount: String(data.principalAmount ?? 28000),
    totalAmountPayable: String(data.totalAmountPayable ?? 35000),
    interestOrFee: String(data.interestOrFee ?? 7000),
    loanDuration: data.loanDuration || "1 Month",
    startDate: data.startDate || "2026-09-23",
    dueDate: data.dueDate || "2026-10-23",
    lenderName: data.lenderName || "Hari Kranth Sai",
    lenderContact: data.lenderContact || "6304228363",
    borrowerName: data.borrowerName || "Kuppili Abhilash",
    borrowerContact: data.borrowerContact || "9876543210",
    borrowerAddress: data.borrowerAddress || "Visakhapatnam, Andhra Pradesh",
    registeredOwner: data.registeredOwner || "Golla Ramu",
    vehicleMakeModel: data.vehicleMakeModel || "Honda Dio (Drum Variant, BS-VI)",
    vehicleRegNumber: (data.vehicleRegNumber || "AP39QY9367").toUpperCase(),
    engineNumber: (data.engineNumber || "JF98EW0193408").toUpperCase(),
    chassisNumber: (data.chassisNumber || "ME4JF983GNW095191").toUpperCase(),
    vehicleColor: data.vehicleColor || "Matte Axis Grey",
    fuelType: data.fuelType || "Petrol",
    collateralStatus: data.collateralStatus || "physical_possession_yard",
    yardLocation: data.yardLocation || "Finexa Secured Compound / Yard Bay #3",
    yardInDate: data.yardInDate || "2026-09-23",
    odometerReading: data.odometerReading ? String(data.odometerReading) : "14250.0",
    keyHandedOver: data.keyHandedOver ?? true,
    documentsCollected: (data.documentsCollected as any) || [
      "Original Smart Card RC",
      "Signed RTO Form 29 & Form 30",
      "Signed Security Cheque(s)",
    ],
    status: data.status || "active_in_yard",
    notes: data.notes || "Vehicle collateralized and stored in yard.",
  };

  const [inserted] = await db
    .insert(vehicleCollateralLoansTable)
    .values(insertData)
    .returning();

  return mapDbRecordToModel(inserted);
}

/**
 * Update loan status (e.g. mark notice sent, mark settled, etc.)
 */
export async function updateVehicleLoanStatus(
  applicationCode: string,
  status: VehicleLoanStatus,
  options?: { settlementNoticeSent?: boolean; notes?: string }
): Promise<VehicleCollateralLoanData | null> {
  await ensureVehicleLoansTableStructure();

  const updateFields: any = {
    status,
    updatedAt: new Date(),
  };

  if (options?.settlementNoticeSent) {
    updateFields.settlementNoticeSentAt = new Date();
  }
  if (options?.notes) {
    updateFields.notes = options.notes;
  }
  if (status === "settled_released") {
    updateFields.settledAt = new Date();
    updateFields.collateralStatus = "released_to_owner";
  }

  const [updated] = await db
    .update(vehicleCollateralLoansTable)
    .set(updateFields)
    .where(eq(vehicleCollateralLoansTable.applicationCode, applicationCode))
    .returning();

  return updated ? mapDbRecordToModel(updated) : null;
}

/**
 * Seed initial record if database is fresh
 */
async function seedDefaultVehicleLoan(): Promise<VehicleCollateralLoanData | null> {
  try {
    return await createVehicleLoanInDb(mapFormDataToModel(DEFAULT_VEHICLE_LOAN));
  } catch (e) {
    console.error("[vehicleLoanRepository] Failed to seed default record:", e);
    return null;
  }
}

function mapDbRecordToModel(row: VehicleCollateralLoan): VehicleCollateralLoanData {
  return {
    id: row.id,
    applicationCode: row.applicationCode,
    loanType: row.loanType,
    principalAmount: Number(row.principalAmount),
    totalAmountPayable: Number(row.totalAmountPayable),
    interestOrFee: Number(row.interestOrFee),
    loanDuration: row.loanDuration,
    startDate: row.startDate,
    dueDate: row.dueDate,
    lenderName: row.lenderName,
    lenderContact: row.lenderContact,
    borrowerName: row.borrowerName,
    borrowerContact: row.borrowerContact || "",
    borrowerAddress: row.borrowerAddress || "",
    registeredOwner: row.registeredOwner,
    vehicleMakeModel: row.vehicleMakeModel,
    vehicleRegNumber: row.vehicleRegNumber,
    engineNumber: row.engineNumber,
    chassisNumber: row.chassisNumber,
    vehicleColor: row.vehicleColor || "",
    fuelType: row.fuelType || "",
    collateralStatus: row.collateralStatus,
    yardLocation: row.yardLocation,
    yardInDate: row.yardInDate || "",
    odometerReading: row.odometerReading ? Number(row.odometerReading) : undefined,
    keyHandedOver: row.keyHandedOver,
    documentsCollected: Array.isArray(row.documentsCollected) ? (row.documentsCollected as string[]) : [],
    status: row.status as VehicleLoanStatus,
    settlementNoticeSentAt: row.settlementNoticeSentAt ? row.settlementNoticeSentAt.toISOString() : null,
    settlementAmountPaid: row.settlementAmountPaid ? Number(row.settlementAmountPaid) : 0,
    settledAt: row.settledAt ? row.settledAt.toISOString() : null,
    notes: row.notes || "",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDbRowToModel(row: any): VehicleCollateralLoanData {
  return {
    id: row.id,
    applicationCode: row.application_code,
    loanType: row.loan_type,
    principalAmount: Number(row.principal_amount),
    totalAmountPayable: Number(row.total_amount_payable),
    interestOrFee: Number(row.interest_or_fee),
    loanDuration: row.loan_duration,
    startDate: row.start_date,
    dueDate: row.due_date,
    lenderName: row.lender_name,
    lenderContact: row.lender_contact,
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact || "",
    borrowerAddress: row.borrower_address || "",
    registeredOwner: row.registered_owner,
    vehicleMakeModel: row.vehicle_make_model,
    vehicleRegNumber: row.vehicle_reg_number,
    engineNumber: row.engine_number,
    chassisNumber: row.chassis_number,
    vehicleColor: row.vehicle_color || "",
    fuelType: row.fuel_type || "",
    collateralStatus: row.collateral_status,
    yardLocation: row.yard_location,
    yardInDate: row.yard_in_date || "",
    odometerReading: row.odometer_reading ? Number(row.odometer_reading) : undefined,
    keyHandedOver: row.key_handed_over,
    documentsCollected: Array.isArray(row.documents_collected) ? row.documents_collected : [],
    status: row.status as VehicleLoanStatus,
    settlementNoticeSentAt: row.settlement_notice_sent_at,
    settlementAmountPaid: Number(row.settlement_amount_paid || 0),
    settledAt: row.settled_at,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFormDataToModel(data: any): VehicleCollateralLoanData {
  return {
    applicationCode: data.applicationCode,
    loanType: data.loanType,
    principalAmount: Number(data.principalAmount),
    totalAmountPayable: Number(data.totalAmountPayable),
    interestOrFee: Number(data.interestOrFee),
    loanDuration: data.loanDuration,
    startDate: data.startDate,
    dueDate: data.dueDate,
    lenderName: data.lenderName,
    lenderContact: data.lenderContact,
    borrowerName: data.borrowerName,
    borrowerContact: data.borrowerContact,
    borrowerAddress: data.borrowerAddress,
    registeredOwner: data.registeredOwner,
    vehicleMakeModel: data.vehicleMakeModel,
    vehicleRegNumber: data.vehicleRegNumber,
    engineNumber: data.engineNumber,
    chassisNumber: data.chassisNumber,
    vehicleColor: data.vehicleColor,
    fuelType: data.fuelType,
    collateralStatus: data.collateralStatus,
    yardLocation: data.yardLocation,
    yardInDate: data.yardInDate,
    odometerReading: data.odometerReading,
    keyHandedOver: data.keyHandedOver,
    documentsCollected: data.documentsCollected,
    status: data.status,
    notes: data.notes,
  };
}
