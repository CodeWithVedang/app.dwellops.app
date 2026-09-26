import type { ComplaintCategory, ComplaintStatus, Priority } from "@/generated/prisma/enums";

export const COMPLAINT_CATEGORIES: { value: ComplaintCategory; label: string; emoji: string }[] = [
  { value: "PLUMBING", label: "Plumbing", emoji: "🚰" },
  { value: "ELECTRICAL", label: "Electrical", emoji: "💡" },
  { value: "CIVIL", label: "Civil", emoji: "🧱" },
  { value: "LIFT", label: "Lift", emoji: "🛗" },
  { value: "CLEANING", label: "Cleaning", emoji: "🧹" },
  { value: "SECURITY", label: "Security", emoji: "🛡️" },
  { value: "WATER", label: "Water", emoji: "💧" },
  { value: "PARKING", label: "Parking", emoji: "🅿️" },
  { value: "COMMON_AREA", label: "Common area", emoji: "🌳" },
  { value: "OTHER", label: "Other", emoji: "📝" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  NEW: "New",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

/** Default SLA hours per priority (PRD §8). */
export const DEFAULT_SLA_HOURS: Record<Priority, number> = { CRITICAL: 4, HIGH: 12, NORMAL: 48, LOW: 72 };

export const OPEN_STATUSES: ComplaintStatus[] = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "WAITING", "REOPENED"];
