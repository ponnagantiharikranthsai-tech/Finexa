import { z } from "zod";

export const recordPaymentSchema = z.object({
  loanId: z.string().uuid("Invalid loan ID"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(10000000),
  paymentType: z.enum(["interest", "principal", "penalty"]),
  paymentDate: z.string().date("Invalid date format (must be YYYY-MM-DD)"),
  notes: z.string().optional().or(z.literal("")),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
