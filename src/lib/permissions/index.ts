import type { SocietyRole } from "@/generated/prisma/enums";

/** Central permission catalogue: `resource.action`. */
export const PERMISSIONS = [
  "society.update",
  "building.manage",
  "unit.manage",
  "member.invite",
  "member.view",
  "member.manage",
  "complaint.create",
  "complaint.view_all",
  "complaint.view_assigned",
  "complaint.acknowledge",
  "complaint.assign",
  "complaint.work",
  "complaint.resolve",
  "complaint.close",
  "complaint.cancel",
  "notice.manage",
  "notice.view_stats",
  "parcel.log",
  "parcel.view_all",
  "parcel.handover",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const GATE: Permission[] = ["parcel.log", "parcel.view_all", "parcel.handover"];

const MANAGER: Permission[] = [
  "building.manage",
  "unit.manage",
  "member.invite",
  "member.view",
  "member.manage",
  "complaint.create",
  "complaint.view_all",
  "complaint.acknowledge",
  "complaint.assign",
  "complaint.work",
  "complaint.resolve",
  "complaint.close",
  "complaint.cancel",
  "notice.manage",
  "notice.view_stats",
  ...GATE,
  "audit.view",
];

export const ROLE_PERMISSIONS: Record<SocietyRole, readonly Permission[]> = {
  SOCIETY_ADMIN: [...MANAGER, "society.update"],
  SOCIETY_MANAGER: MANAGER,
  COMMITTEE_MEMBER: [
    "member.view",
    "complaint.create",
    "complaint.view_all",
    "complaint.view_assigned",
    "complaint.work",
    "complaint.resolve",
    "notice.manage",
    "notice.view_stats",
    "parcel.view_all",
    "audit.view",
  ],
  ACCOUNTANT: ["member.view"],
  SECURITY_MANAGER: ["complaint.create", "complaint.view_assigned", "complaint.work", "complaint.resolve", ...GATE],
  STAFF: ["complaint.view_assigned", "complaint.work", "complaint.resolve", ...GATE],
  VENDOR: ["complaint.view_assigned", "complaint.work", "complaint.resolve"],
  RESIDENT: ["complaint.create"],
  TENANT: ["complaint.create"],
};

export function permissionsFor(roles: readonly SocietyRole[]): Set<Permission> {
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}

export function can(roles: readonly SocietyRole[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}

/** Roles that can be assigned complaint work. */
export const ASSIGNABLE_ROLES: readonly SocietyRole[] = ["STAFF", "VENDOR", "COMMITTEE_MEMBER", "SECURITY_MANAGER", "SOCIETY_MANAGER"];
