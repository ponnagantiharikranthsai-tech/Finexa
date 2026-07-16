import { z } from "zod";

export const updateBorrowerSchema = z.object({
  borrowerId: z.string().uuid("Invalid borrower ID"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.string().email("Enter a valid email address"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid PAN number (uppercase)"),
  aadhaar: z.string().regex(/^\d{12}$/, "Enter a valid 12-digit Aadhaar number"),
  locationUrl: z.string().url("Enter a valid location URL (Google Maps)").optional().or(z.literal("")),
});

export type UpdateBorrowerInput = z.infer<typeof updateBorrowerSchema>;
