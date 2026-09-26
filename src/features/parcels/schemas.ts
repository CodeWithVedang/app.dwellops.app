import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const COURIERS = ["Amazon", "Flipkart", "Blue Dart", "Delhivery", "DTDC", "India Post", "Swiggy / Zomato", "Other"] as const;

export const logParcelSchema = z.object({
  unitId: z.uuid("Choose the flat."),
  courier: z.string().trim().min(2, "Choose or type the courier.").max(60),
  trackingNumber: optionalText(60),
  description: optionalText(200),
  storageLocation: optionalText(80),
});

export const handoverSchema = z.object({
  parcelId: z.uuid(),
  code: z.string().trim().regex(/^\d{4}$/, "Enter the 4-digit pickup code."),
  collectedByName: z.string().trim().min(2, "Who is collecting it?").max(80),
});

export const returnParcelSchema = z.object({
  parcelId: z.uuid(),
  notes: z.string().trim().min(3, "Say why it was returned.").max(300),
});

export const listParcelsSchema = z.object({
  view: z.enum(["waiting", "collected", "all"]).default("waiting"),
  q: z.string().trim().max(60).optional(),
});
