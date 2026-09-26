import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, hasPermission, type SocietyContext } from "@/lib/auth/context";
import { rateLimit } from "@/lib/auth/rate-limit";
import { AppError, conflict, notFound } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { handoverSchema, listParcelsSchema, logParcelSchema, returnParcelSchema } from "@/features/parcels/schemas";

const WAITING = ["RECEIVED", "NOTIFIED"] as const;
/** Parcels uncollected this long get flagged so the gate can chase the resident. */
const STALE_AFTER_MS = 48 * 3_600_000;

export const newPickupCode = (): string => randomInt(0, 10_000).toString().padStart(4, "0");

function codesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Row-level visibility: gate/committee see everything; residents see their own flats. */
function visibility(ctx: SocietyContext): Prisma.ParcelWhereInput {
  if (hasPermission(ctx, "parcel.view_all")) return {};
  return { unit: { members: { some: { memberId: { in: ctx.memberIds } } } } };
}

async function unitResidents(unitId: string) {
  const links = await db.unitMember.findMany({ where: { unitId, member: { status: "ACTIVE" } }, select: { member: { select: { userId: true } } } });
  return [...new Set(links.map((l) => l.member.userId))];
}

export const parcelService = {
  async list(ctx: SocietyContext, raw: unknown) {
    const { view, q } = listParcelsSchema.parse(raw);
    const filters: Prisma.ParcelWhereInput[] = [visibility(ctx), { societyId: ctx.societyId }];
    if (view === "waiting") filters.push({ status: { in: [...WAITING] } });
    if (view === "collected") filters.push({ status: { in: ["COLLECTED", "RETURNED"] } });
    if (q) {
      filters.push({
        OR: [
          { unit: { unitNumber: { contains: q, mode: "insensitive" } } },
          { courier: { contains: q, mode: "insensitive" } },
          { trackingNumber: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    const rows = await db.parcel.findMany({
      where: { AND: filters },
      orderBy: view === "waiting" ? { receivedAt: "asc" } : { receivedAt: "desc" },
      take: 200,
      include: { unit: { select: { unitNumber: true, building: { select: { code: true } } } } },
    });
    const gate = hasPermission(ctx, "parcel.view_all");
    // The pickup code is for residents only; the gate must ask for it.
    const staleBefore = Date.now() - STALE_AFTER_MS;
    return rows.map((p) => ({
      ...p,
      pickupCode: gate ? null : p.pickupCode,
      stale: WAITING.includes(p.status as (typeof WAITING)[number]) && p.receivedAt.getTime() < staleBefore,
    }));
  },

  async waitingCount(ctx: SocietyContext): Promise<number> {
    return db.parcel.count({ where: { AND: [visibility(ctx), { societyId: ctx.societyId, status: { in: [...WAITING] } }] } });
  },

  async log(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "parcel.log");
    const input = logParcelSchema.parse(raw);
    const unit = await db.unit.findFirst({
      where: { id: input.unitId, societyId: ctx.societyId },
      select: { id: true, unitNumber: true, building: { select: { code: true } } },
    });
    if (!unit) throw notFound("Flat");
    const residents = await unitResidents(unit.id);
    const code = newPickupCode();

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const parcel = await db.$transaction(async (tx) => {
          const last = await tx.parcel.findFirst({ where: { societyId: ctx.societyId }, orderBy: { number: "desc" }, select: { number: true } });
          const p = await tx.parcel.create({
            data: {
              ...input,
              societyId: ctx.societyId,
              number: (last?.number ?? 0) + 1,
              pickupCode: code,
              receivedById: ctx.user.id,
              status: residents.length ? "NOTIFIED" : "RECEIVED",
            },
          });
          await audit.log(tx, {
            societyId: ctx.societyId,
            actorId: ctx.user.id,
            action: "parcel.received",
            entityType: "Parcel",
            entityId: p.id,
            after: { number: p.number, unit: unit.unitNumber, courier: p.courier },
          });
          return p;
        });
        await Promise.all(
          residents.map((userId) =>
            notify({
              societyId: ctx.societyId,
              userId,
              dedupeKey: `parcel:${parcel.id}:received`,
              template: "parcel.received",
              title: `📦 ${parcel.courier} parcel at the gate`,
              body: `Pickup code ${code}. Show it at the gate to collect.`,
              link: `/s/${ctx.societySlug}/parcels`,
            }),
          ),
        );
        return { ...parcel, notified: residents.length, unitLabel: `${unit.building.code} · ${unit.unitNumber}` };
      } catch (e) {
        if (e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002" && attempt < 2) continue;
        throw e;
      }
    }
    throw conflict("Couldn't save the parcel. Please try again.");
  },

  async handover(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "parcel.handover");
    const input = handoverSchema.parse(raw);
    if (!rateLimit(`parcel-code:${input.parcelId}`, 5, 15 * 60 * 1000)) {
      throw new AppError("RATE_LIMITED", "Too many wrong codes. Ask the resident to check the app, then try again in 15 minutes.");
    }
    const p = await db.parcel.findFirst({ where: { id: input.parcelId, societyId: ctx.societyId } });
    if (!p) throw notFound("Parcel");
    if (!WAITING.includes(p.status as (typeof WAITING)[number])) throw conflict("This parcel was already handed over or returned.");
    if (!codesMatch(p.pickupCode, input.code)) {
      throw new AppError("VALIDATION", "That code doesn't match.", { code: ["That code doesn't match. Ask the resident to check the DwellOps app."] });
    }
    await db.$transaction(async (tx) => {
      const r = await tx.parcel.updateMany({
        where: { id: p.id, societyId: ctx.societyId, status: { in: [...WAITING] } },
        data: { status: "COLLECTED", collectedAt: new Date(), collectedByName: input.collectedByName, handedOverById: ctx.user.id },
      });
      if (r.count !== 1) throw conflict("This parcel was already handed over.");
      await audit.log(tx, {
        societyId: ctx.societyId,
        actorId: ctx.user.id,
        action: "parcel.collected",
        entityType: "Parcel",
        entityId: p.id,
        before: { status: p.status },
        after: { status: "COLLECTED", collectedByName: input.collectedByName },
      });
    });
    const residents = await unitResidents(p.unitId);
    await Promise.all(
      residents.map((userId) =>
        notify({
          societyId: ctx.societyId,
          userId,
          dedupeKey: `parcel:${p.id}:collected`,
          template: "parcel.collected",
          title: `Parcel collected by ${input.collectedByName}`,
          body: `${p.courier} parcel #${p.number} was handed over at the gate.`,
          link: `/s/${ctx.societySlug}/parcels?view=collected`,
        }),
      ),
    );
  },

  async markReturned(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "parcel.handover");
    const input = returnParcelSchema.parse(raw);
    await db.$transaction(async (tx) => {
      const r = await tx.parcel.updateMany({
        where: { id: input.parcelId, societyId: ctx.societyId, status: { in: [...WAITING] } },
        data: { status: "RETURNED", returnedAt: new Date(), notes: input.notes },
      });
      if (r.count !== 1) throw notFound("Waiting parcel");
      await audit.log(tx, { societyId: ctx.societyId, actorId: ctx.user.id, action: "parcel.returned", entityType: "Parcel", entityId: input.parcelId, after: { notes: input.notes } });
    });
  },
};
