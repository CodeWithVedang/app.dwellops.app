import type { NoticeAudience, NoticeCategory, NoticePriority, NoticeStatus, SocietyRole, UnitRelation } from "@/generated/prisma/enums";

/** What we know about a member when deciding which notices reach them. */
export interface AudienceFacts {
  roles: readonly SocietyRole[];
  buildingIds: readonly string[];
  relations: readonly UnitRelation[];
}

const COMMITTEE_ROLES: readonly SocietyRole[] = ["SOCIETY_ADMIN", "COMMITTEE_MEMBER"];
const STAFF_ROLES: readonly SocietyRole[] = ["STAFF", "SECURITY_MANAGER", "SOCIETY_MANAGER"];

export function noticeReaches(notice: { audience: NoticeAudience; buildingId: string | null }, m: AudienceFacts): boolean {
  switch (notice.audience) {
    case "ALL":
      return true;
    case "BUILDING":
      return !!notice.buildingId && m.buildingIds.includes(notice.buildingId);
    case "OWNERS":
      return m.relations.includes("OWNER") || m.roles.includes("RESIDENT");
    case "TENANTS":
      return m.relations.includes("TENANT") || m.roles.includes("TENANT");
    case "COMMITTEE":
      return m.roles.some((r) => COMMITTEE_ROLES.includes(r));
    case "STAFF":
      return m.roles.some((r) => STAFF_ROLES.includes(r));
  }
}

export type NoticeState = "DRAFT" | "LIVE" | "EXPIRED" | "ARCHIVED";

export function noticeState(n: { status: NoticeStatus; expiresAt: Date | null }, now = new Date()): NoticeState {
  if (n.status === "DRAFT") return "DRAFT";
  if (n.status === "ARCHIVED") return "ARCHIVED";
  return n.expiresAt && n.expiresAt <= now ? "EXPIRED" : "LIVE";
}

export const CATEGORY_META: Record<NoticeCategory, { label: string; emoji: string }> = {
  GENERAL: { label: "General", emoji: "📢" },
  MAINTENANCE_WORK: { label: "Maintenance work", emoji: "🛠️" },
  WATER: { label: "Water supply", emoji: "💧" },
  ELECTRICITY: { label: "Electricity", emoji: "⚡" },
  MEETING: { label: "Meeting", emoji: "🗓️" },
  EVENT: { label: "Event", emoji: "🎉" },
  SECURITY: { label: "Security", emoji: "🛡️" },
  RULES: { label: "Rules & policy", emoji: "📘" },
};

export const PRIORITY_LABEL: Record<NoticePriority, string> = { NORMAL: "Normal", IMPORTANT: "Important", URGENT: "Urgent" };

export const AUDIENCE_LABEL: Record<NoticeAudience, string> = {
  ALL: "Everyone",
  BUILDING: "One building",
  OWNERS: "Owners",
  TENANTS: "Tenants",
  COMMITTEE: "Committee",
  STAFF: "Staff & security",
};
