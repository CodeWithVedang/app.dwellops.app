import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { authorize, type SocietyContext } from "@/lib/auth/context";

const auditQuery = z.object({
  entityId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 50;

/** Audit log reads and in-app notification inbox. */
export const activityService = {
  async listAudit(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "audit.view");
    const input = auditQuery.parse(raw);
    const where = { societyId: ctx.societyId, ...(input.entityId ? { entityId: input.entityId } : {}) };
    const [items, total] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      db.auditLog.count({ where }),
    ]);
    const actorIds = [...new Set(items.map((i) => i.actorId).filter((v): v is string => !!v))];
    const actors = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
    const names = new Map(actors.map((a) => [a.id, a.name]));
    return {
      items: items.map((i) => ({ ...i, actorName: i.actorId ? (names.get(i.actorId) ?? "Unknown") : "System" })),
      total,
      page: input.page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  },

  listNotifications(ctx: SocietyContext) {
    return db.notification.findMany({
      where: { userId: ctx.user.id, societyId: ctx.societyId, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async markAllRead(ctx: SocietyContext): Promise<number> {
    const r = await db.notification.updateMany({
      where: { userId: ctx.user.id, societyId: ctx.societyId, readAt: null },
      data: { readAt: new Date() },
    });
    return r.count;
  },

  /** Recent audit entries for the dashboard feed (managers only). */
  async recent(ctx: SocietyContext, take = 8) {
    authorize(ctx, "audit.view");
    return (await activityService.listAudit(ctx, { page: 1 })).items.slice(0, take);
  },
};

