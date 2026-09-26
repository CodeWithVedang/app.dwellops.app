import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ComplaintStatus } from "@/generated/prisma/enums";
import { db, type Tx } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, hasPermission, type SocietyContext } from "@/lib/auth/context";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { rupeesToPaise } from "@/lib/money";
import { complaintDetailInclude, complaintRepository, type ComplaintDetail } from "@/server/repositories/complaintRepository";
import { canTransition, computeDueAt } from "@/features/complaints/domain";
import { OPEN_STATUSES, STATUS_LABEL } from "@/features/complaints/constants";
import {
  assignComplaintSchema,
  commentSchema,
  createComplaintSchema,
  listComplaintsSchema,
  residentDecisionSchema,
  resolveComplaintSchema,
  updateStatusSchema,
} from "@/features/complaints/schemas";

const PAGE_SIZE = 20;

/** Row-level visibility for the current member. */
function visibilityFilter(ctx: SocietyContext): Prisma.ComplaintWhereInput {
  if (hasPermission(ctx, "complaint.view_all")) return {};
  const own: Prisma.ComplaintWhereInput[] = [
    { raisedById: { in: ctx.memberIds } },
    { unit: { members: { some: { memberId: { in: ctx.memberIds } } } } },
  ];
  if (hasPermission(ctx, "complaint.view_assigned")) own.push({ assigneeId: { in: ctx.memberIds } });
  return { OR: own };
}

const isAssignee = (ctx: SocietyContext, c: { assigneeId: string | null }) =>
  !!c.assigneeId && ctx.memberIds.includes(c.assigneeId);
const isRaiser = (ctx: SocietyContext, c: { raisedById: string }) => ctx.memberIds.includes(c.raisedById);

function assertTransition(from: ComplaintStatus, to: ComplaintStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError("INVALID_TRANSITION", `A ${STATUS_LABEL[from].toLowerCase()} complaint can't be moved to ${STATUS_LABEL[to].toLowerCase()}.`);
  }
}

async function loadVisible(ctx: SocietyContext, complaintId: string): Promise<ComplaintDetail> {
  const c = await db.complaint.findFirst({
    where: { AND: [{ id: complaintId, societyId: ctx.societyId }, visibilityFilter(ctx)] },
    include: complaintDetailInclude,
  });
  if (!c) throw notFound("Complaint");
  return c;
}

interface TransitionArgs {
  ctx: SocietyContext;
  complaint: ComplaintDetail;
  to: ComplaintStatus;
  data?: Prisma.ComplaintUncheckedUpdateManyInput;
  note?: string;
  action: string;
  activityType?: "STATUS_CHANGED" | "ASSIGNED";
  extra?: (tx: Tx) => Promise<void>;
}

/** Guarded state change: validates transition, updates with optimistic check, writes activity + audit atomically. */
async function transition({ ctx, complaint, to, data = {}, note, action, activityType = "STATUS_CHANGED", extra }: TransitionArgs) {
  assertTransition(complaint.status, to);
  await db.$transaction(async (tx) => {
    const n = await complaintRepository.updateIfStatus(tx, ctx.societyId, complaint.id, complaint.status, { ...data, status: to });
    if (n !== 1) throw conflict("This complaint was updated by someone else. Refresh and try again.");
    await tx.complaintActivity.create({
      data: { complaintId: complaint.id, actorId: ctx.user.id, type: activityType, fromStatus: complaint.status, toStatus: to, note: note ?? null },
    });
    await audit.log(tx, {
      societyId: ctx.societyId,
      actorId: ctx.user.id,
      action,
      entityType: "Complaint",
      entityId: complaint.id,
      before: { status: complaint.status, assigneeId: complaint.assigneeId },
      after: { status: to, ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId as string | null } : {}) },
    });
    if (extra) await extra(tx);
  });
}

async function notifyMember(ctx: SocietyContext, memberId: string, key: string, template: string, title: string, body: string, complaintId: string) {
  const member = await db.societyMember.findFirst({ where: { id: memberId, societyId: ctx.societyId }, select: { userId: true } });
  if (!member || member.userId === ctx.user.id) return;
  await notify({
    societyId: ctx.societyId,
    userId: member.userId,
    dedupeKey: key,
    template,
    title,
    body,
    link: `/s/${ctx.societySlug}/complaints/${complaintId}`,
  });
}

export const complaintService = {
  async list(ctx: SocietyContext, raw: unknown) {
    const input = listComplaintsSchema.parse(raw);
    const filters: Prisma.ComplaintWhereInput[] = [visibilityFilter(ctx)];
    if (input.status === "OPEN") filters.push({ status: { in: OPEN_STATUSES } });
    else if (input.status === "OVERDUE") filters.push({ status: { in: OPEN_STATUSES }, dueAt: { lt: new Date() } });
    else if (input.status) filters.push({ status: input.status });
    if (input.q) {
      const n = Number(input.q.replace(/^#/, ""));
      filters.push({
        OR: [
          { title: { contains: input.q, mode: "insensitive" } },
          { unit: { unitNumber: { contains: input.q, mode: "insensitive" } } },
          ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : []),
        ],
      });
    }
    const [items, total] = await complaintRepository.list(db, ctx.societyId, { AND: filters }, input.page, PAGE_SIZE);
    return { items, total, page: input.page, pageSize: PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  },

  get: loadVisible,

  async summary(ctx: SocietyContext) {
    const where = visibilityFilter(ctx);
    const [byStatus, overdue] = await Promise.all([
      complaintRepository.countByStatus(db, ctx.societyId, where),
      complaintRepository.countOverdue(db, ctx.societyId, OPEN_STATUSES, where),
    ]);
    const counts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Partial<Record<ComplaintStatus, number>>;
    const open = OPEN_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
    return { counts, open, overdue, awaitingConfirmation: counts.RESOLVED ?? 0, unassigned: (counts.NEW ?? 0) + (counts.ACKNOWLEDGED ?? 0) + (counts.REOPENED ?? 0) };
  },

  async create(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "complaint.create");
    const input = createComplaintSchema.parse(raw);
    if (input.unitId) {
      const where: Prisma.UnitWhereInput = { id: input.unitId, societyId: ctx.societyId };
      // Non-managers can only raise complaints for their own units.
      if (!hasPermission(ctx, "complaint.view_all")) where.members = { some: { memberId: { in: ctx.memberIds } } };
      if (!(await db.unit.findFirst({ where, select: { id: true } }))) throw forbidden("You can only raise complaints for your own unit.");
    }
    const raisedById = ctx.memberIds[0];
    if (!raisedById) throw forbidden();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const complaint = await db.$transaction(async (tx) => {
          const number = await complaintRepository.nextNumber(tx, ctx.societyId);
          const now = new Date();
          const c = await tx.complaint.create({
            data: { ...input, societyId: ctx.societyId, number, raisedById, dueAt: computeDueAt(now, input.priority) },
          });
          await tx.complaintActivity.create({ data: { complaintId: c.id, actorId: ctx.user.id, type: "CREATED", toStatus: "NEW" } });
          await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "complaint.created", entityType: "Complaint", entityId: c.id, after: { number, title: c.title, category: c.category, priority: c.priority } });
          return c;
        });
        // Tell managers a new complaint arrived.
        const managers = await db.societyMember.findMany({
          where: { societyId: ctx.societyId, status: "ACTIVE", role: { in: ["SOCIETY_ADMIN", "SOCIETY_MANAGER"] } },
          select: { id: true },
        });
        await Promise.all(
          managers.map((m) =>
            notifyMember(ctx, m.id, `complaint:${complaint.id}:created`, "complaint.created", `New complaint #${complaint.number}`, complaint.title, complaint.id),
          ),
        );
        return complaint;
      } catch (e) {
        // Concurrent create took the same number; retry with the next one.
        if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002" && attempt < 2) continue;
        throw e;
      }
    }
    throw conflict("Couldn't save the complaint. Please try again.");
  },

  async acknowledge(ctx: SocietyContext, complaintId: string) {
    authorize(ctx, "complaint.acknowledge");
    const c = await loadVisible(ctx, complaintId);
    await transition({ ctx, complaint: c, to: "ACKNOWLEDGED", action: "complaint.acknowledged" });
    await notifyMember(ctx, c.raisedById, `complaint:${c.id}:ACKNOWLEDGED`, "complaint.status_changed", `Complaint #${c.number} acknowledged`, "The society office has seen your complaint.", c.id);
  },

  async assign(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "complaint.assign");
    const input = assignComplaintSchema.parse(raw);
    const c = await loadVisible(ctx, input.complaintId);
    const assignee = await db.societyMember.findFirst({
      where: { id: input.assigneeId, societyId: ctx.societyId, status: "ACTIVE", role: { in: [...ASSIGNABLE_ROLES] } },
      include: { user: { select: { name: true } } },
    });
    if (!assignee) throw new AppError("VALIDATION", "Choose a valid staff member.", { assigneeId: ["Choose a valid staff member."] });
    await transition({
      ctx,
      complaint: c,
      to: "ASSIGNED",
      activityType: "ASSIGNED",
      action: "complaint.assigned",
      note: [`Assigned to ${assignee.user.name}`, input.note].filter(Boolean).join(" — "),
      data: { assigneeId: assignee.id, expectedCompletion: input.expectedCompletion ?? null },
    });
    await notifyMember(ctx, assignee.id, `complaint:${c.id}:assigned:${assignee.id}:${c.activities.length}`, "complaint.assigned", `Complaint #${c.number} assigned to you`, c.title, c.id);
    await notifyMember(ctx, c.raisedById, `complaint:${c.id}:ASSIGNED:${c.activities.length}`, "complaint.status_changed", `Complaint #${c.number} assigned`, `${assignee.user.name} will handle it.`, c.id);
  },

  async updateStatus(ctx: SocietyContext, raw: unknown) {
    const input = updateStatusSchema.parse(raw);
    const c = await loadVisible(ctx, input.complaintId);
    if (input.status === "ACKNOWLEDGED") return complaintService.acknowledge(ctx, c.id);
    if (input.status === "CANCELLED") {
      const raiserCanCancel = isRaiser(ctx, c) && (c.status === "NEW" || c.status === "ACKNOWLEDGED");
      if (!raiserCanCancel && !hasPermission(ctx, "complaint.cancel")) throw forbidden();
    } else {
      authorize(ctx, "complaint.work");
      if (!isAssignee(ctx, c) && !hasPermission(ctx, "complaint.assign")) throw forbidden("Only the assigned person can update this complaint.");
    }
    await transition({ ctx, complaint: c, to: input.status, note: input.note, action: `complaint.${input.status.toLowerCase()}` });
    await notifyMember(ctx, c.raisedById, `complaint:${c.id}:${input.status}:${c.activities.length}`, "complaint.status_changed", `Complaint #${c.number}: ${STATUS_LABEL[input.status]}`, input.note ?? c.title, c.id);
  },

  async resolve(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "complaint.resolve");
    const input = resolveComplaintSchema.parse(raw);
    const c = await loadVisible(ctx, input.complaintId);
    if (!isAssignee(ctx, c) && !hasPermission(ctx, "complaint.assign")) throw forbidden("Only the assigned person can resolve this complaint.");
    await transition({
      ctx,
      complaint: c,
      to: "RESOLVED",
      note: input.resolutionNote,
      action: "complaint.resolved",
      data: {
        resolutionNote: input.resolutionNote,
        resolutionCostPaise: input.cost ? rupeesToPaise(input.cost) : null,
        resolvedAt: new Date(),
      },
    });
    await notifyMember(ctx, c.raisedById, `complaint:${c.id}:RESOLVED:${c.activities.length}`, "complaint.resolved", `Complaint #${c.number} resolved`, "Please confirm the fix or reopen it.", c.id);
  },

  async residentDecision(ctx: SocietyContext, raw: unknown) {
    const input = residentDecisionSchema.parse(raw);
    const c = await loadVisible(ctx, input.complaintId);
    if (!isRaiser(ctx, c) && !hasPermission(ctx, "complaint.close")) throw forbidden();
    if (input.decision === "CONFIRM") {
      await transition({ ctx, complaint: c, to: "CLOSED", note: input.note, action: "complaint.closed", data: { closedAt: new Date() } });
      if (c.assigneeId) await notifyMember(ctx, c.assigneeId, `complaint:${c.id}:CLOSED`, "complaint.status_changed", `Complaint #${c.number} closed`, "The resident confirmed the fix.", c.id);
    } else {
      if (!input.note) throw new AppError("VALIDATION", "Tell us what is still wrong.", { note: ["Tell us what is still wrong."] });
      await transition({ ctx, complaint: c, to: "REOPENED", note: input.note, action: "complaint.reopened", data: { resolvedAt: null } });
      if (c.assigneeId) await notifyMember(ctx, c.assigneeId, `complaint:${c.id}:REOPENED:${c.activities.length}`, "complaint.status_changed", `Complaint #${c.number} reopened`, input.note, c.id);
    }
  },

  async comment(ctx: SocietyContext, raw: unknown) {
    const input = commentSchema.parse(raw);
    const c = await loadVisible(ctx, input.complaintId);
    await db.$transaction(async (tx) => {
      const a = await tx.complaintActivity.create({ data: { complaintId: c.id, actorId: ctx.user.id, type: "COMMENT", note: input.note } });
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "complaint.commented", entityType: "Complaint", entityId: c.id, after: { activityId: a.id } });
    });
  },

  /** Names for activity actors (activities store user ids). */
  async actorNames(ids: string[]): Promise<Map<string, string>> {
    const users = await db.user.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
    return new Map(users.map((u) => [u.id, u.name]));
  },
};
