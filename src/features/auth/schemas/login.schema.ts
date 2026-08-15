import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(3, "Please enter a valid email or mobile number"),
  password: z.string().min(1, "Please enter your password"),
});

export type LoginInput = z.infer<typeof loginSchema>;
