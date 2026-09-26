import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NoticeAudience } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, hasPermission, type SocietyContext } from "@/lib/auth/context";
import { conflict, notFound } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { noticeReaches, type AudienceFacts } from "@/features/notices/domain";
import { createNoticeSchema, listNoticesSchema, noticeIdSchema } from "@/features/notices/schemas";

async function factsFor(ctx: SocietyContext): Promise<AudienceFacts> {
  const links = await db.unitMember.findMany({
    where: { memberId: { in: ctx.memberIds } },
    select: { relation: true, unit: { select: { buildingId: true } } },
  });
  return { roles: ctx.roles, buildingIds: links.map((l) => l.unit.buildingId), relations: links.map((l) => l.relation) };
}

/** Everyone in the society the notice reaches, one entry per user. */
async function recipientsOf(societyId: string, notice: { audience: NoticeAudience; buildingId: string | null }) {
  const members = await db.societyMember.findMany({
    where: { societyId, status: "ACTIVE" },
    select: { userId: true, role: true, user: { select: { name: true } }, unitLinks: { select: { relation: true, unit: { select: { buildingId: true, unitNumber: true } } } } },
  });
  const byUser = new Map<string, { userId: string; name: string; units: string[]; facts: AudienceFacts }>();
  for (const m of members) {
    const cur = byUser.get(m.userId) ?? { userId: m.userId, name: m.user.name, units: [], facts: { roles: [], buildingIds: [], relations: [] } };
    cur.facts = {
      roles: [...cur.facts.roles, m.role],
      buildingIds: [...cur.facts.buildingIds, ...m.unitLinks.map((l) => l.unit.buildingId)],
      relations: [...cur.facts.relations, ...m.unitLinks.map((l) => l.relation)],
    };
    cur.units.push(...m.unitLinks.map((l) => l.unit.unitNumber));
    byUser.set(m.userId, cur);
  }
  return [...byUser.values()].filter((u) => noticeReaches(notice, u.facts));
}

const liveWhere = (): Prisma.NoticeWhereInput => ({
  status: "PUBLISHED",
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export const noticeService = {
  async list(ctx: SocietyContext, raw: unknown) {
    const { view } = listNoticesSchema.parse(raw);
    const manages = hasPermission(ctx, "notice.manage");
    let where: Prisma.NoticeWhereInput;
    if (view === "drafts") {
      authorize(ctx, "notice.manage");
      where = { status: "DRAFT" };
    } else if (view === "past") {
      where = { OR: [{ status: "ARCHIVED" }, { status: "PUBLISHED", expiresAt: { lte: new Date() } }] };
    } else {
      where = liveWhere();
    }
    const rows = await db.notice.findMany({
      where: { AND: [where, { societyId: ctx.societyId }] },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        building: { select: { code: true, name: true } },
        reads: { where: { userId: ctx.user.id }, select: { readAt: true, acknowledgedAt: true } },
        _count: { select: { reads: true } },
      },
    });
    // Non-managers only see notices addressed to them.
    const facts = manages ? null : await factsFor(ctx);
    return rows
      .filter((n) => !facts || noticeReaches(n, facts))
      .map(({ reads, ...n }) => ({ ...n, myRead: reads[0] ?? null }));
  },

  async get(ctx: SocietyContext, noticeId: string) {
    const n = await db.notice.findFirst({
      where: { id: noticeId, societyId: ctx.societyId },
      include: { building: { select: { code: true, name: true } } },
    });
    if (!n) throw notFound("Notice");
    const manages = hasPermission(ctx, "notice.manage");
    if (!manages) {
      if (n.status === "DRAFT" || !noticeReaches(n, await factsFor(ctx))) throw notFound("Notice");
    }
    let myRead = null;
    if (n.status === "PUBLISHED") {
      myRead = await db.noticeRead.upsert({
        where: { noticeId_userId: { noticeId: n.id, userId: ctx.user.id } },
        create: { noticeId: n.id, userId: ctx.user.id },
        update: {},
      });
    }
    const author = await db.user.findUnique({ where: { id: n.createdById }, select: { name: true } });
    return { ...n, myRead, authorName: author?.name ?? "Society office" };
  },

  async create(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "notice.manage");
    const { intent, ...input } = createNoticeSchema.parse(raw);
    if (input.buildingId) {
      const b = await db.building.findFirst({ where: { id: input.buildingId, societyId: ctx.societyId }, select: { id: true } });
      if (!b) throw notFound("Building");
    }
    const publish = intent === "publish";
    const notice = await db.$transaction(async (tx) => {
      const n = await tx.notice.create({
        data: {
          ...input,
          buildingId: input.audience === "BUILDING" ? input.buildingId : null,
          societyId: ctx.societyId,
          createdById: ctx.user.id,
          status: publish ? "PUBLISHED" : "DRAFT",
          publishedAt: publish ? new Date() : null,
        },
      });
      await audit.log(tx, {
        societyId: ctx.societyId,
        actorId: ctx.user.id,
        action: publish ? "notice.published" : "notice.drafted",
        entityType: "Notice",
        entityId: n.id,
        after: { title: n.title, audience: n.audience, priority: n.priority },
      });
      return n;
    });
    if (publish) await noticeService.fanOut(ctx, notice);
    return notice;
  },

  async publish(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "notice.manage");
    const { noticeId } = noticeIdSchema.parse(raw);
    const n = await db.$transaction(async (tx) => {
      const r = await tx.notice.updateMany({
        where: { id: noticeId, societyId: ctx.societyId, status: "DRAFT" },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
      if (r.count !== 1) throw conflict("Only drafts can be published.");
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "notice.published", entityType: "Notice", entityId: noticeId });
      return tx.notice.findUniqueOrThrow({ where: { id: noticeId } });
    });
    await noticeService.fanOut(ctx, n);
  },

  async archive(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "notice.manage");
    const { noticeId } = noticeIdSchema.parse(raw);
    await db.$transaction(async (tx) => {
      const r = await tx.notice.updateMany({
        where: { id: noticeId, societyId: ctx.societyId, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", pinned: false },
      });
      if (r.count !== 1) throw notFound("Notice");
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "notice.archived", entityType: "Notice", entityId: noticeId });
    });
  },

  async acknowledge(ctx: SocietyContext, raw: unknown) {
    const { noticeId } = noticeIdSchema.parse(raw);
    const n = await noticeService.get(ctx, noticeId); // enforces visibility + records read
    if (!n.requiresAck || n.status !== "PUBLISHED") throw conflict("This notice doesn't need confirmation.");
    await db.noticeRead.update({
      where: { noticeId_userId: { noticeId, userId: ctx.user.id } },
      data: { acknowledgedAt: new Date() },
    });
  },

  /** Who the notice reached and who has read / confirmed it. */
  async stats(ctx: SocietyContext, noticeId: string) {
    authorize(ctx, "notice.view_stats");
    const n = await db.notice.findFirst({ where: { id: noticeId, societyId: ctx.societyId } });
    if (!n) throw notFound("Notice");
    const [recipients, reads] = await Promise.all([
      recipientsOf(ctx.societyId, n),
      db.noticeRead.findMany({ where: { noticeId }, select: { userId: true, readAt: true, acknowledgedAt: true } }),
    ]);
    const readMap = new Map(reads.map((r) => [r.userId, r]));
    const rows = recipients
      .map((r) => ({ userId: r.userId, name: r.name, units: r.units, read: readMap.get(r.userId) ?? null }))
      .sort((a, b) => Number(!!a.read) - Number(!!b.read) || a.name.localeCompare(b.name));
    return {
      total: rows.length,
      read: rows.filter((r) => r.read).length,
      acknowledged: rows.filter((r) => r.read?.acknowledgedAt).length,
      rows,
    };
  },

  async unreadCount(ctx: SocietyContext): Promise<number> {
    const live = await noticeService.list(ctx, { view: "current" });
    return live.filter((n) => !n.myRead).length;
  },

  /** In-app notification to every recipient. Idempotent per notice + user. */
  async fanOut(ctx: SocietyContext, n: { id: string; title: string; priority: string; audience: NoticeAudience; buildingId: string | null }) {
    const recipients = await recipientsOf(ctx.societyId, n);
    const prefix = n.priority === "URGENT" ? "Urgent notice" : "New notice";
    await Promise.all(
      recipients
        .filter((r) => r.userId !== ctx.user.id)
        .map((r) =>
          notify({
            societyId: ctx.societyId,
            userId: r.userId,
            dedupeKey: `notice:${n.id}:published`,
            template: "notice.published",
            title: `${prefix}: ${n.title}`,
            body: "Tap to read it.",
            link: `/s/${ctx.societySlug}/notices/${n.id}`,
          }),
        ),
    );
  },
};
