import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, type SocietyContext } from "@/lib/auth/context";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { changeRoleSchema, idSchema, memberStatusSchema, updateBuildingSchema, updateUnitSchema } from "@/features/society/schemas";

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Admin edit / delete operations for setup data and people.
 * Deletes are only allowed when nothing depends on the record; otherwise the message says what to do.
 * People are never hard-deleted (their complaints and history must survive) — they are disabled.
 */
export const adminService = {
  async updateBuilding(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "building.manage");
    const { buildingId, ...input } = updateBuildingSchema.parse(raw);
    const before = await db.building.findFirst({ where: { id: buildingId, societyId: ctx.societyId } });
    if (!before) throw notFound("Building");
    const highest = await db.unit.aggregate({ where: { buildingId }, _max: { floor: true } });
    if ((highest._max.floor ?? 0) > input.floors) {
      throw conflict(`A flat is on floor ${highest._max.floor}. Keep at least that many floors, or move the flat first.`);
    }
    try {
      await db.$transaction(async (tx) => {
        await tx.building.update({ where: { id: buildingId }, data: input });
        await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "building.updated", entityType: "Building", entityId: buildingId, before: { name: before.name, code: before.code, floors: before.floors }, after: input });
      });
    } catch (e) {
      if (isUnique(e)) throw conflict(`Another building already uses code ${input.code}.`);
      throw e;
    }
  },

  async deleteBuilding(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "building.manage");
    const { id } = idSchema.parse(raw);
    const b = await db.building.findFirst({ where: { id, societyId: ctx.societyId }, include: { _count: { select: { units: true } } } });
    if (!b) throw notFound("Building");
    if (b._count.units > 0) throw conflict(`${b.name} still has ${b._count.units} flat${b._count.units === 1 ? "" : "s"}. Delete or move them first.`);
    await db.$transaction(async (tx) => {
      await tx.building.delete({ where: { id } });
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "building.deleted", entityType: "Building", entityId: id, before: { name: b.name, code: b.code } });
    });
  },

  async updateUnit(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "unit.manage");
    const { unitId, ...input } = updateUnitSchema.parse(raw);
    const before = await db.unit.findFirst({ where: { id: unitId, societyId: ctx.societyId }, include: { building: true } });
    if (!before) throw notFound("Flat");
    if (input.floor > before.building.floors) throw conflict(`${before.building.name} has only ${before.building.floors} floors.`);
    try {
      await db.$transaction(async (tx) => {
        await tx.unit.update({ where: { id: unitId }, data: { ...input, areaSqft: input.areaSqft ?? null } });
        await audit.log(tx, {
          societyId: ctx.societyId,
          actorId: ctx.user.id,
          action: "unit.updated",
          entityType: "Unit",
          entityId: unitId,
          before: { unitNumber: before.unitNumber, floor: before.floor, unitType: before.unitType, areaSqft: before.areaSqft, occupancy: before.occupancy },
          after: { ...input, areaSqft: input.areaSqft ?? null },
        });
      });
    } catch (e) {
      if (isUnique(e)) throw conflict(`Flat ${input.unitNumber} already exists in ${before.building.name}.`);
      throw e;
    }
  },

  async deleteUnit(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "unit.manage");
    const { id } = idSchema.parse(raw);
    const u = await db.unit.findFirst({
      where: { id, societyId: ctx.societyId },
      include: { _count: { select: { members: true, complaints: true, parcels: true } } },
    });
    if (!u) throw notFound("Flat");
    const { members, complaints, parcels } = u._count;
    if (members || complaints || parcels) {
      const parts = [members && `${members} resident${members === 1 ? "" : "s"}`, complaints && `${complaints} complaint${complaints === 1 ? "" : "s"}`, parcels && `${parcels} parcel${parcels === 1 ? "" : "s"}`].filter(Boolean);
      throw conflict(`Flat ${u.unitNumber} has ${parts.join(", ")} linked, so it can't be deleted. Edit it instead.`);
    }
    await db.$transaction(async (tx) => {
      await tx.invitation.deleteMany({ where: { unitId: id, acceptedAt: null } });
      await tx.unit.delete({ where: { id } });
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "unit.deleted", entityType: "Unit", entityId: id, before: { unitNumber: u.unitNumber } });
    });
  },

  async changeRole(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "member.manage");
    const { memberId, role } = changeRoleSchema.parse(raw);
    const m = await db.societyMember.findFirst({ where: { id: memberId, societyId: ctx.societyId } });
    if (!m) throw notFound("Member");
    const isAdmin = ctx.roles.includes("SOCIETY_ADMIN");
    if ((role === "SOCIETY_ADMIN" || m.role === "SOCIETY_ADMIN") && !isAdmin) throw forbidden("Only a society admin can change admin roles.");
    if (m.role === role) return;
    if (m.role === "SOCIETY_ADMIN") await assertAnotherAdmin(ctx.societyId, m.id);
    try {
      await db.$transaction(async (tx) => {
        await tx.societyMember.update({ where: { id: memberId }, data: { role } });
        await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "member.role_changed", entityType: "SocietyMember", entityId: memberId, before: { role: m.role }, after: { role } });
      });
    } catch (e) {
      if (isUnique(e)) throw conflict("This person already has that role.");
      throw e;
    }
  },

  /** Disable = remove access but keep history. Re-enable restores it. */
  async setMemberStatus(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "member.manage");
    const { memberId, status } = memberStatusSchema.parse(raw);
    const m = await db.societyMember.findFirst({ where: { id: memberId, societyId: ctx.societyId } });
    if (!m) throw notFound("Member");
    if (m.role === "SOCIETY_ADMIN" && !ctx.roles.includes("SOCIETY_ADMIN")) throw forbidden("Only a society admin can remove another admin.");
    if (status === "DISABLED" && m.role === "SOCIETY_ADMIN") await assertAnotherAdmin(ctx.societyId, m.id);
    await db.$transaction(async (tx) => {
      await tx.societyMember.update({ where: { id: memberId }, data: { status } });
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: status === "DISABLED" ? "member.removed" : "member.restored", entityType: "SocietyMember", entityId: memberId, before: { status: m.status }, after: { status } });
    });
  },

  async revokeInvite(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "member.invite");
    const { id } = idSchema.parse(raw);
    const r = await db.$transaction(async (tx) => {
      const del = await tx.invitation.deleteMany({ where: { id, societyId: ctx.societyId, acceptedAt: null } });
      if (del.count) await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "member.invite_revoked", entityType: "Invitation", entityId: id });
      return del.count;
    });
    if (!r) throw notFound("Invite");
  },
};

async function assertAnotherAdmin(societyId: string, exceptMemberId: string) {
  const others = await db.societyMember.count({ where: { societyId, role: "SOCIETY_ADMIN", status: "ACTIVE", id: { not: exceptMemberId } } });
  if (others === 0) throw conflict("A society needs at least one admin. Make someone else admin first.");
}
