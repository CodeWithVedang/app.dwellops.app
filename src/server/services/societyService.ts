import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { SocietyRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, type SocietyContext } from "@/lib/auth/context";
import type { SessionUser } from "@/lib/auth/session";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { conflict, notFound } from "@/lib/errors";
import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { actionEmail, sendEmail } from "@/lib/email";
import { createBuildingSchema, createSocietySchema, createUnitSchema, inviteMemberSchema } from "@/features/society/schemas";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export function slugify(name: string): string {
  const s = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return s || "society";
}

export const societyService = {
  listForUser(userId: string) {
    return db.society.findMany({
      where: { members: { some: { userId, status: "ACTIVE" } } },
      select: { slug: true, name: true, city: true, members: { where: { userId }, select: { role: true } } },
      orderBy: { name: "asc" },
    });
  },

  /** Any signed-in user can create a society and becomes its SOCIETY_ADMIN. */
  async createSociety(user: SessionUser, raw: unknown): Promise<{ slug: string }> {
    const input = createSocietySchema.parse(raw);
    const base = slugify(input.name);
    const slugTaken = await db.society.findUnique({ where: { slug: base }, select: { id: true } });
    const slug = slugTaken ? `${base}-${randomBytes(3).toString("hex")}` : base;
    return db.$transaction(async (tx) => {
      const society = await tx.society.create({ data: { ...input, slug } });
      const member = await tx.societyMember.create({
        data: { societyId: society.id, userId: user.id, role: "SOCIETY_ADMIN" },
      });
      await audit.log(tx, {
        societyId: society.id,
        actorId: user.id,
        action: "society.created",
        entityType: "Society",
        entityId: society.id,
        after: { name: society.name, slug },
      });
      await audit.log(tx, {
        societyId: society.id,
        actorId: user.id,
        action: "member.added",
        entityType: "SocietyMember",
        entityId: member.id,
        after: { role: "SOCIETY_ADMIN" },
      });
      return { slug };
    });
  },

  listBuildings(ctx: SocietyContext) {
    return db.building.findMany({
      where: { societyId: ctx.societyId },
      orderBy: { code: "asc" },
      include: { _count: { select: { units: true } } },
    });
  },

  async createBuilding(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "building.manage");
    const input = createBuildingSchema.parse(raw);
    try {
      return await db.$transaction(async (tx) => {
        const b = await tx.building.create({ data: { ...input, societyId: ctx.societyId } });
        await audit.log(tx, {
          societyId: ctx.societyId,
          actorId: ctx.user.id,
          action: "building.created",
          entityType: "Building",
          entityId: b.id,
          after: input,
        });
        return b;
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict(`A building with code ${input.code} already exists.`);
      throw e;
    }
  },

  listUnits(ctx: SocietyContext) {
    return db.unit.findMany({
      where: { societyId: ctx.societyId },
      orderBy: [{ building: { code: "asc" } }, { unitNumber: "asc" }],
      include: {
        building: { select: { code: true, name: true } },
        members: { include: { member: { select: { role: true, user: { select: { name: true } } } } } },
      },
    });
  },

  async createUnit(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "unit.manage");
    const input = createUnitSchema.parse(raw);
    const building = await db.building.findFirst({ where: { id: input.buildingId, societyId: ctx.societyId } });
    if (!building) throw notFound("Building");
    if (input.floor > building.floors) throw conflict(`${building.name} has only ${building.floors} floors.`);
    try {
      return await db.$transaction(async (tx) => {
        const u = await tx.unit.create({ data: { ...input, societyId: ctx.societyId } });
        await audit.log(tx, {
          societyId: ctx.societyId,
          actorId: ctx.user.id,
          action: "unit.created",
          entityType: "Unit",
          entityId: u.id,
          after: input,
        });
        return u;
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict(`Unit ${input.unitNumber} already exists in ${building.name}.`);
      throw e;
    }
  },

  listMembers(ctx: SocietyContext) {
    authorize(ctx, "member.view");
    return db.societyMember.findMany({
      where: { societyId: ctx.societyId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { name: true, email: true } },
        unitLinks: { include: { unit: { select: { unitNumber: true, building: { select: { code: true } } } } } },
      },
    });
  },

  listPendingInvites(ctx: SocietyContext) {
    authorize(ctx, "member.invite");
    return db.invitation.findMany({
      where: { societyId: ctx.societyId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      include: { unit: { select: { unitNumber: true, building: { select: { code: true } } } } },
    });
  },

  /**
   * Create an invite and return the one-time link. The raw token is returned once; only its hash is stored.
   * No email provider is configured yet, so the admin shares the link directly.
   */
  async inviteMember(
    ctx: SocietyContext,
    raw: unknown,
  ): Promise<{ inviteUrl: string; email: string; emailed: boolean }> {
    authorize(ctx, "member.invite");
    const input = inviteMemberSchema.parse(raw);
    if (input.role === "SOCIETY_ADMIN" && !ctx.roles.includes("SOCIETY_ADMIN")) {
      throw conflict("Only a society admin can invite another admin.");
    }
    if (input.unitId) {
      const unit = await db.unit.findFirst({ where: { id: input.unitId, societyId: ctx.societyId }, select: { id: true } });
      if (!unit) throw notFound("Unit");
    }
    const existingMember = await db.societyMember.findFirst({
      where: { societyId: ctx.societyId, role: input.role, user: { email: input.email } },
      select: { id: true },
    });
    if (existingMember) throw conflict("This person already has that role in the society.");

    const token = generateToken();
    const invite = await db.$transaction(async (tx) => {
      const inv = await tx.invitation.create({
        data: {
          societyId: ctx.societyId,
          email: input.email,
          name: input.name,
          role: input.role,
          unitId: input.unitId ?? null,
          relation: input.role === "TENANT" ? "TENANT" : input.role === "RESIDENT" ? "OWNER" : null,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          invitedById: ctx.user.id,
        },
      });
      await audit.log(tx, {
        societyId: ctx.societyId,
        actorId: ctx.user.id,
        action: "member.invited",
        entityType: "Invitation",
        entityId: inv.id,
        after: { email: input.email, role: input.role, unitId: input.unitId ?? null },
      });
      return inv;
    });

    const invitePath = `/invite/${token}`;
    const existingUser = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existingUser) {
      await notify({
        societyId: ctx.societyId,
        userId: existingUser.id,
        dedupeKey: `invite:${invite.id}`,
        template: "member.invited",
        title: `You're invited to ${ctx.societyName}`,
        body: "Open the invite to join.",
        link: invitePath,
      });
    }
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}${invitePath}`;
    const emailed = await sendEmail(
      actionEmail({
        to: input.email,
        subject: `You're invited to ${ctx.societyName} on DwellOps`,
        heading: `${ctx.user.name} invited you to ${ctx.societyName}`,
        intro: "DwellOps is where your society shares notices, tracks complaints and tells you when a parcel arrives. Set a password to join.",
        cta: "Join your society",
        url: inviteUrl,
        footer: "This invite works for 7 days and only once. If you weren't expecting it, you can ignore this email.",
      }),
    );
    return { inviteUrl, email: input.email, emailed };
  },

  listAssignees(ctx: SocietyContext) {
    authorize(ctx, "complaint.assign");
    return db.societyMember.findMany({
      where: { societyId: ctx.societyId, status: "ACTIVE", role: { in: [...ASSIGNABLE_ROLES] as SocietyRole[] } },
      select: { id: true, role: true, user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    });
  },

  /** Units the current user belongs to (for the resident complaint form). */
  myUnits(ctx: SocietyContext) {
    return db.unit.findMany({
      where: { societyId: ctx.societyId, members: { some: { memberId: { in: ctx.memberIds } } } },
      select: { id: true, unitNumber: true, building: { select: { code: true } } },
    });
  },

  async setupProgress(ctx: SocietyContext) {
    const [buildings, units, members] = await Promise.all([
      db.building.count({ where: { societyId: ctx.societyId } }),
      db.unit.count({ where: { societyId: ctx.societyId } }),
      db.societyMember.count({ where: { societyId: ctx.societyId } }),
    ]);
    return { buildings, units, members };
  },
};
