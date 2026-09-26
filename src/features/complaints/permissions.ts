import type { ComplaintStatus, SocietyRole } from "@/generated/prisma/enums";
import { can } from "@/lib/permissions";
import { canTransition } from "./domain";

export interface ComplaintActor {
  roles: readonly SocietyRole[];
  memberIds: readonly string[];
}

interface ComplaintRef {
  status: ComplaintStatus;
  raisedById: string;
  assigneeId: string | null;
}

/**
 * Which next steps to offer in the UI. Mirrors the checks in complaintService,
 * which remains the authority — this only decides what buttons to show.
 */
export function allowedComplaintActions(actor: ComplaintActor, c: ComplaintRef) {
  const isAssignee = !!c.assigneeId && actor.memberIds.includes(c.assigneeId);
  const isRaiser = actor.memberIds.includes(c.raisedById);
  const manages = can(actor.roles, "complaint.assign");
  const works = can(actor.roles, "complaint.work") && (isAssignee || manages);
  return {
    acknowledge: can(actor.roles, "complaint.acknowledge") && canTransition(c.status, "ACKNOWLEDGED"),
    assign: manages && canTransition(c.status, "ASSIGNED"),
    start: works && canTransition(c.status, "IN_PROGRESS"),
    wait: works && canTransition(c.status, "WAITING"),
    resolve: can(actor.roles, "complaint.resolve") && (isAssignee || manages) && canTransition(c.status, "RESOLVED"),
    decide: (isRaiser || can(actor.roles, "complaint.close")) && c.status === "RESOLVED",
    cancel:
      canTransition(c.status, "CANCELLED") &&
      (can(actor.roles, "complaint.cancel") || (isRaiser && (c.status === "NEW" || c.status === "ACKNOWLEDGED"))),
  };
}
