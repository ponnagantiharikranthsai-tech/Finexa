import { pgTable, uuid, text, numeric, date, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const vehicleCollateralLoansTable = pgTable("vehicle_collateral_loans", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  applicationCode: text("application_code").notNull().unique(), // e.g. LN-2026-DIO35K
  loanType: text("loan_type").notNull().default("Vehicle Collateral Loan (Emergency/Hospital Purpose)"),

  principalAmount: numeric("principal_amount", { precision: 12, scale: 2 }).notNull().default("28000.00"),
  totalAmountPayable: numeric("total_amount_payable", { precision: 12, scale: 2 }).notNull().default("35000.00"),
  interestOrFee: numeric("interest_or_fee", { precision: 12, scale: 2 }).notNull().default("7000.00"),

  loanDuration: text("loan_duration").notNull().default("1 Month"),
  startDate: date("start_date").notNull().default(sql`CURRENT_DATE`),
  dueDate: date("due_date").notNull(),

  // Party Details
  lenderName: text("lender_name").notNull().default("Hari Kranth Sai"),
  lenderContact: text("lender_contact").notNull().default("6304228363"),
  borrowerName: text("borrower_name").notNull().default("Kuppili Abhilash"),
  borrowerContact: text("borrower_contact").default("9876543210"),
  borrowerAddress: text("borrower_address").default("Visakhapatnam, Andhra Pradesh"),

  // Vehicle & Collateral Identifiers
  registeredOwner: text("registered_owner").notNull().default("Golla Ramu"),
  vehicleMakeModel: text("vehicle_make_model").notNull().default("Honda Dio (Drum Variant, BS-VI)"),
  vehicleRegNumber: text("vehicle_reg_number").notNull().default("AP39QY9367"),
  engineNumber: text("engine_number").notNull().default("JF98EW0193408"),
  chassisNumber: text("chassis_number").notNull().default("ME4JF983GNW095191"),
  vehicleColor: text("vehicle_color").default("Matte Axis Grey / Sports Yellow"),
  fuelType: text("fuel_type").default("Petrol"),

  // Custody & Yard Information
  collateralStatus: text("collateral_status").notNull().default("physical_possession_yard"),
  yardLocation: text("yard_location").notNull().default("Finexa Secured Compound / Yard Bay #3"),
  yardInDate: date("yard_in_date").default(sql`CURRENT_DATE`),
  odometerReading: numeric("odometer_reading", { precision: 10, scale: 1 }).default("14250.0"),
  keyHandedOver: boolean("key_handed_over").notNull().default(true),

  // Document Inventory
  documentsCollected: jsonb("documents_collected").notNull().default(sql`'["Original Smart Card RC", "Signed RTO Form 29 & Form 30", "Signed Security Cheque(s)"]'::jsonb`),

  // Operational Lifecycle
  status: text("status").notNull().default("active_in_yard"), // 'active_in_yard', 'pending_settlement', 'settled_released', 'default_notice'
  settlementNoticeSentAt: timestamp("settlement_notice_sent_at", { withTimezone: true }),
  settlementAmountPaid: numeric("settlement_amount_paid", { precision: 12, scale: 2 }).default("0.00"),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  notes: text("notes").default("Emergency/Hospital Purpose collateral loan. Vehicle retained in yard."),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_vcl_application_code").on(table.applicationCode),
  index("idx_vcl_vehicle_reg").on(table.vehicleRegNumber),
  index("idx_vcl_status").on(table.status),
  index("idx_vcl_due_date").on(table.dueDate),
]);

export type VehicleCollateralLoan = typeof vehicleCollateralLoansTable.$inferSelect;
export type InsertVehicleCollateralLoan = typeof vehicleCollateralLoansTable.$inferInsert;
