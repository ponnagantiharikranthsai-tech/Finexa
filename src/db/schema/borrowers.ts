import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const borrowersTable = pgTable("borrowers", {
  borrowerId: uuid("borrower_id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  name: text("name").notNull(),
  mobile: text("mobile").notNull().unique(),
  email: text("email"),

  panEncrypted: text("pan_encrypted").notNull(),
  aadhaarEncrypted: text("aadhaar_encrypted").notNull(),

  fatherName: text("father_name"),
  motherName: text("mother_name"),
  alternateMobile: text("alternate_mobile"),
  fatherMobile: text("father_mobile"),
  address: text("address"),
  district: text("district"),
  state: text("state"),
  pinCode: text("pin_code"),

  aadhaarFrontUrl: text("aadhaar_front_url"),
  aadhaarBackUrl: text("aadhaar_back_url"),
  panCardUrl: text("pan_card_url"),
  selfieUrl: text("selfie_url"),
  signatureUrl: text("signature_url"),

  locationUrl: text("location_url"),

  internalNotes: text("internal_notes"),
  internalNotesUpdatedAt: timestamp("internal_notes_updated_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
}, (table) => [
  index("idx_borrowers_aadhaar").on(table.aadhaarEncrypted),
  index("idx_borrowers_name").on(table.name),
  index("idx_borrowers_mobile").on(table.mobile),
  index("idx_borrowers_pan").on(table.panEncrypted),
]);

export type Borrower = typeof borrowersTable.$inferSelect;
export type InsertBorrower = typeof borrowersTable.$inferInsert;
