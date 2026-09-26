import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const createComplaintSchema = z.object({
  category: z.enum(["PLUMBING", "ELECTRICAL", "CIVIL", "LIFT", "CLEANING", "SECURITY", "WATER", "PARKING", "COMMON_AREA", "OTHER"]),
  title: z.string().trim().min(3, "Add a short title (at least 3 characters).").max(120),
  description: z.string().trim().min(5, "Describe the problem (at least 5 characters).").max(4000),
  location: optionalText(200),
  priority: z.enum(["CRITICAL", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
  preferredAccessTime: optionalText(120),
  unitId: z.uuid().optional(),
});
export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

export const assignComplaintSchema = z.object({
  complaintId: z.uuid(),
  assigneeId: z.uuid({ message: "Choose who should handle this." }),
  expectedCompletion: z.coerce.date().optional(),
  note: optionalText(1000),
});

export const updateStatusSchema = z.object({
  complaintId: z.uuid(),
  status: z.enum(["ACKNOWLEDGED", "IN_PROGRESS", "WAITING", "CANCELLED"]),
  note: optionalText(1000),
});

export const resolveComplaintSchema = z.object({
  complaintId: z.uuid(),
  resolutionNote: z.string().trim().min(5, "Explain what was done.").max(2000),
  /** Rupees as entered; converted to paise in service. */
  cost: z
    .string()
    .trim()
    .regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter an amount like 1250 or 1250.50")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const residentDecisionSchema = z.object({
  complaintId: z.uuid(),
  decision: z.enum(["CONFIRM", "REOPEN"]),
  note: optionalText(1000),
});

export const commentSchema = z.object({
  complaintId: z.uuid(),
  note: z.string().trim().min(1, "Write a comment.").max(2000),
});

export const listComplaintsSchema = z.object({
  status: z.enum(["OPEN", "NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED", "OVERDUE"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListComplaintsInput = z.infer<typeof listComplaintsSchema>;
