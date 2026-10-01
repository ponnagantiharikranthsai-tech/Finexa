import { z } from "zod";

export const vehicleLoanFormSchema = z.object({
  applicationCode: z.string().min(3, "Application code is required"),
  loanType: z.string().min(3, "Loan type is required"),
  principalAmount: z.number().positive("Principal amount must be positive"),
  totalAmountPayable: z.number().positive("Total amount payable must be positive"),
  interestOrFee: z.number().min(0, "Interest/fee cannot be negative"),
  loanDuration: z.string().min(1, "Loan duration is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),

  lenderName: z.string().min(2, "Lender name is required"),
  lenderContact: z.string().regex(/^\d{10}$/, "Lender contact must be 10 digits"),
  borrowerName: z.string().min(2, "Borrower name is required"),
  borrowerContact: z.string().regex(/^\d{10}$/, "Borrower contact must be 10 digits"),
  borrowerAddress: z.string().min(5, "Address must be at least 5 characters"),

  registeredOwner: z.string().min(2, "Registered vehicle owner is required"),
  vehicleMakeModel: z.string().min(2, "Vehicle make & model is required"),
  vehicleRegNumber: z.string().min(4, "Vehicle registration number is required"),
  engineNumber: z.string().min(4, "Engine number is required"),
  chassisNumber: z.string().min(4, "Chassis number is required"),
  vehicleColor: z.string().optional(),
  fuelType: z.string().optional(),

  collateralStatus: z.string().min(2, "Collateral status is required"),
  yardLocation: z.string().min(2, "Yard location is required"),
  yardInDate: z.string().optional(),
  odometerReading: z.number().min(0).optional(),
  keyHandedOver: z.boolean().default(true),

  documentsCollected: z.array(z.string()).min(1, "Select at least one document collected"),
  status: z.enum(["active_in_yard", "pending_settlement", "settled_released", "default_notice"]).default("active_in_yard"),
  notes: z.string().optional(),
});

export type VehicleLoanFormData = z.infer<typeof vehicleLoanFormSchema>;

export const DEFAULT_VEHICLE_LOAN: VehicleLoanFormData = {
  applicationCode: "LN-2026-DIO35K",
  loanType: "Vehicle Collateral Loan (Emergency/Hospital Purpose)",
  principalAmount: 28000,
  totalAmountPayable: 35000,
  interestOrFee: 7000,
  loanDuration: "1 Month",
  startDate: "2026-09-23",
  dueDate: "2026-10-23",

  lenderName: "Hari Kranth Sai",
  lenderContact: "6304228363",
  borrowerName: "Kuppili Abhilash",
  borrowerContact: "9876543210",
  borrowerAddress: "H.No 4-12, Gajuwaka Main Road, Visakhapatnam, Andhra Pradesh - 530026",

  registeredOwner: "Golla Ramu",
  vehicleMakeModel: "Honda Dio (Drum Variant, BS-VI)",
  vehicleRegNumber: "AP39QY9367",
  engineNumber: "JF98EW0193408",
  chassisNumber: "ME4JF983GNW095191",
  vehicleColor: "Matte Axis Grey / Sports Yellow",
  fuelType: "Petrol",

  collateralStatus: "Physical Possession (Retained in yard/garage)",
  yardLocation: "Finexa Secured Compound / Yard Bay #3",
  yardInDate: "2026-09-23",
  odometerReading: 14250,
  keyHandedOver: true,

  documentsCollected: [
    "Original Smart Card RC",
    "Signed RTO Form 29 & Form 30",
    "Signed Security Cheque(s)",
  ],
  status: "active_in_yard",
  notes: "Urgent emergency medical / hospital expense loan. Vehicle retained under physical custody at Finexa yard. RC card & RTO transfer forms verified and deposited in locker.",
};
