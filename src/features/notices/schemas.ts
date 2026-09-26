import { z } from "zod";

const bool = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false")])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

export const createNoticeSchema = z
  .object({
    title: z.string().trim().min(4, "Give the notice a clear title.").max(140),
    body: z.string().trim().min(10, "Write the details (at least 10 characters).").max(5000),
    category: z.enum(["GENERAL", "MAINTENANCE_WORK", "WATER", "ELECTRICITY", "MEETING", "EVENT", "SECURITY", "RULES"]).default("GENERAL"),
    priority: z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
    audience: z.enum(["ALL", "BUILDING", "OWNERS", "TENANTS", "COMMITTEE", "STAFF"]).default("ALL"),
    buildingId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
    pinned: bool,
    requiresAck: bool,
    expiresAt: z.coerce.date().optional().or(z.literal("").transform(() => undefined)),
    intent: z.enum(["publish", "draft"]).default("publish"),
  })
  .refine((v) => v.audience !== "BUILDING" || !!v.buildingId, { path: ["buildingId"], message: "Choose the building." })
  .refine((v) => !v.expiresAt || v.expiresAt > new Date(), { path: ["expiresAt"], message: "Pick a time in the future." });

export const noticeIdSchema = z.object({ noticeId: z.uuid() });

export const listNoticesSchema = z.object({
  view: z.enum(["current", "drafts", "past"]).default("current"),
});
