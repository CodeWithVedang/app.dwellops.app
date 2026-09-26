import { z } from "zod";

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(100),
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email.").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const createSocietySchema = z.object({
  name: z.string().trim().min(3, "Enter the society name.").max(120),
  address: z.string().trim().min(5, "Enter the address.").max(300),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  state: z.string().trim().min(2, "Enter the state.").max(80),
  contactEmail: z.email("Enter a valid email.").optional().or(z.literal("").transform(() => undefined)),
  contactPhone: z.string().trim().max(20).optional(),
});

export const createBuildingSchema = z.object({
  name: z.string().trim().min(1, "Enter a building or wing name.").max(80),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, "Use up to 10 letters, numbers or dashes."),
  floors: z.coerce.number().int().min(1, "At least 1 floor.").max(200),
});

export const createUnitSchema = z.object({
  buildingId: z.uuid("Choose a building."),
  unitNumber: z.string().trim().min(1, "Enter the unit number.").max(20),
  floor: z.coerce.number().int().min(0).max(200),
  unitType: z.string().trim().max(40).optional(),
  areaSqft: z.coerce.number().int().min(1).max(100000).optional().or(z.literal("").transform(() => undefined)),
});

export const inviteMemberSchema = z
  .object({
    name: z.string().trim().min(2, "Enter their name.").max(100),
    email: z.email("Enter a valid email.").trim().toLowerCase(),
    role: z.enum(["SOCIETY_ADMIN", "COMMITTEE_MEMBER", "SOCIETY_MANAGER", "ACCOUNTANT", "SECURITY_MANAGER", "STAFF", "VENDOR", "RESIDENT", "TENANT"]),
    unitId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  })
  .refine((v) => !(v.role === "RESIDENT" || v.role === "TENANT") || v.unitId, {
    path: ["unitId"],
    message: "Residents and tenants need a unit.",
  });

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Enter a valid email.").trim().toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    confirm: z.string().max(200),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export const emailTokenSchema = z.object({ token: z.string().min(20).max(200) });
