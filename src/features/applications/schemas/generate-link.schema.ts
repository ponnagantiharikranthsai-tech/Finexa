import { z } from "zod";

export const generateLinkSchema = z.object({
  principal: z.coerce.number().positive("Amount must be greater than 0").max(10000000),
  interestAmount: z.coerce.number().positive("Interest amount must be greater than 0").max(1000000),
  interestType: z.enum(["monthly", "daily", "weekly"]),
  startDate: z.string().date("Invalid date format (must be YYYY-MM-DD)"),
  dueDate: z.string().date("Invalid date format (must be YYYY-MM-DD)"),
  loanDuration: z.string().min(1, "Duration is required"),
  notes: z.string().optional().or(z.literal("")),
  expiryDays: z.coerce.number().int().nonnegative().optional().or(z.literal("")),
});

export type GenerateLinkInput = z.infer<typeof generateLinkSchema>;
