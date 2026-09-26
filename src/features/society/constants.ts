import type { SocietyRole } from "@/generated/prisma/enums";

export const ROLE_LABEL: Record<SocietyRole, string> = {
  SOCIETY_ADMIN: "Society admin",
  COMMITTEE_MEMBER: "Committee member",
  SOCIETY_MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  SECURITY_MANAGER: "Security manager",
  STAFF: "Staff",
  VENDOR: "Vendor",
  RESIDENT: "Resident (owner)",
  TENANT: "Tenant",
};
