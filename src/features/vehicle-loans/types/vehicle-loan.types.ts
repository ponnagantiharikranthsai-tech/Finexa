export type VehicleLoanStatus = 
  | "active_in_yard"
  | "pending_settlement"
  | "settled_released"
  | "default_notice";

export interface VehicleCollateralLoanData {
  id?: string;
  applicationCode: string;
  loanType: string;
  principalAmount: number;
  totalAmountPayable: number;
  interestOrFee: number;
  loanDuration: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD

  // Party Details
  lenderName: string;
  lenderContact: string;
  borrowerName: string;
  borrowerContact: string;
  borrowerAddress: string;

  // Vehicle Details
  registeredOwner: string;
  vehicleMakeModel: string;
  vehicleRegNumber: string;
  engineNumber: string;
  chassisNumber: string;
  vehicleColor?: string;
  fuelType?: string;

  // Yard / Custody Details
  collateralStatus: string;
  yardLocation: string;
  yardInDate?: string;
  odometerReading?: number;
  keyHandedOver: boolean;

  // Document Inventory
  documentsCollected: string[];

  // Status & Timestamps
  status: VehicleLoanStatus;
  settlementNoticeSentAt?: string | null;
  settlementAmountPaid?: number;
  settledAt?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CountdownTimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOverdue: boolean;
  totalSecondsRemaining: number;
}

export interface SettlementNoticePayload {
  applicationCode: string;
  borrowerName: string;
  borrowerContact: string;
  lenderName: string;
  lenderContact: string;
  vehicleRegNumber: string;
  vehicleMakeModel: string;
  totalAmountPayable: number;
  dueDate: string;
}
