import { VehicleCollateralLoanData } from "./vehicle-loan.types";

/**
 * Supported PDF Document Types for Vehicle Collateral Loans
 */
export type VehicleLoanPdfType = 
  | "borrower_application"    // Official Borrower Application & KYC Verification Form
  | "loan_agreement"          // Legal Collateral Pledge Deed with Non-Judicial Stamp Header
  | "yard_custody_receipt"    // Yard Bailment & Vehicle Physical Handover Voucher
  | "settlement_noc"          // Collateral Release & No-Objection Certificate (NOC)
  | "default_demand_notice";  // Statutory Repayment & Sale Liquidation Notice

export interface VehiclePdfTypeOption {
  type: VehicleLoanPdfType;
  title: string;
  subtitle: string;
  badge: string;
  iconName: string;
  filenamePrefix: string;
}

export const VEHICLE_LOAN_PDF_TYPES: VehiclePdfTypeOption[] = [
  {
    type: "borrower_application",
    title: "Borrower Loan Application Form",
    subtitle: "Official printable KYC application form with vehicle specs & hospital purpose declaration",
    badge: "Application",
    iconName: "FileSpreadsheet",
    filenamePrefix: "FINEXA_Borrower_Application",
  },
  {
    type: "loan_agreement",
    title: "Vehicle Collateral Pledge Agreement",
    subtitle: "Complete printable legal deed with statutory stamp space, covenants & default liquidation clauses",
    badge: "Legal Deed",
    iconName: "FileText",
    filenamePrefix: "FINEXA_Vehicle_Agreement",
  },
  {
    type: "yard_custody_receipt",
    title: "Yard Custody & Bailment Voucher",
    subtitle: "Physical vehicle yard entry slip, odometer reading, key handover & safe custody seal",
    badge: "Custody",
    iconName: "ShieldCheck",
    filenamePrefix: "FINEXA_Yard_Custody_Receipt",
  },
  {
    type: "settlement_noc",
    title: "Settlement & Collateral Release NOC",
    subtitle: "No-Objection Certificate releasing Honda Dio AP39QY9367 and returning original RC/RTO forms",
    badge: "Closure / NOC",
    iconName: "CheckCircle2",
    filenamePrefix: "FINEXA_Collateral_Release_NOC",
  },
  {
    type: "default_demand_notice",
    title: "Legal Repayment & Auction Notice",
    subtitle: "Formal statutory demand for ₹35,000 citing RTO Form 29/30 enforcement powers",
    badge: "Legal Notice",
    iconName: "AlertTriangle",
    filenamePrefix: "FINEXA_Settlement_Notice",
  },
];

export interface VehicleApplicationPdfPayload {
  loan: VehicleCollateralLoanData;
  fatherName?: string;
  fatherContact?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  hospitalPurposeNote?: string;
  signatureName?: string;
  submissionDate?: string;
}
