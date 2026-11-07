import { z } from "zod";

export const newPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .refine((value) => new Set(value).size >= 5, "Use a less repetitive password.");
