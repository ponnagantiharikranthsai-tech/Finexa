import { z } from "zod";

export const createLoanSchema = z.object({
  borrowerId: z.string().uuid("Invalid borrower ID").optional().or(z.literal("")),
  principal: z.coerce.number().positive("Principal must be greater than 0").max(10000000),
  interestType: z.enum(["monthly", "daily"]),
  interestRate: z.coerce.number().positive("Interest rate must be greater than 0").max(1000),
  dateGiven: z.string().date("Invalid date format (must be YYYY-MM-DD)"),
  dueDate: z.string().date("Invalid date format (must be YYYY-MM-DD)"),
  borrowerName: z.string().optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")),
  pan: z.string().optional().or(z.literal("")),
  aadhaar: z.string().optional().or(z.literal("")),
  locationUrl: z.string().optional().or(z.literal("")),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
