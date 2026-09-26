import type { ComplaintStatus, Priority } from "@/generated/prisma/enums";
import { DEFAULT_SLA_HOURS, OPEN_STATUSES } from "./constants";

/** Allowed status transitions. Anything not listed is rejected. */
export const TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  NEW: ["ACKNOWLEDGED", "ASSIGNED", "CANCELLED"],
  ACKNOWLEDGED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING", "RESOLVED"],
  WAITING: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  REOPENED: ["ASSIGNED", "IN_PROGRESS"],
  CLOSED: [],
  CANCELLED: [],
};

export function canTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function computeDueAt(createdAt: Date, priority: Priority, slaHours = DEFAULT_SLA_HOURS): Date {
  return new Date(createdAt.getTime() + slaHours[priority] * 60 * 60 * 1000);
}

export function isOverdue(c: { status: ComplaintStatus; dueAt: Date }, now = new Date()): boolean {
  return OPEN_STATUSES.includes(c.status) && c.dueAt < now;
}
