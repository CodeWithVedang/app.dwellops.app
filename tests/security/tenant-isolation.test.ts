import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../support/db";
import { societyService } from "@/server/services/societyService";
import { complaintService } from "@/server/services/complaintService";
import { activityService } from "@/server/services/activityService";

describe("cross-society access", () => {
  let slugA = "";
  let slugB = "";
  let adminA = "";
  let adminB = "";
  let complaintA = "";
  let unitA = "";
  let buildingA = "";

  beforeAll(async () => {
    await resetDb();
    const a = await makeUser("Alpha");
    const b = await makeUser("Beta");
    adminA = a.id;
    adminB = b.id;
    slugA = (await societyService.createSociety(sessionUser(a), { name: "Alpha Towers", address: "1 Road", city: "Pune", state: "MH" })).slug;
    slugB = (await societyService.createSociety(sessionUser(b), { name: "Beta Heights", address: "2 Road", city: "Pune", state: "MH" })).slug;
    const ctxA = await ctxFor(adminA, slugA);
    buildingA = (await societyService.createBuilding(ctxA, { name: "A", code: "A", floors: 3 })).id;
    unitA = (await societyService.createUnit(ctxA, { buildingId: buildingA, unitNumber: "101", floor: 1 })).id;
    complaintA = (await complaintService.create(ctxA, { category: "WATER", title: "No water", description: "No water since morning" })).id;
  });

  it("non-member cannot load another society's context", async () => {
    await expect(ctxFor(adminB, slugA)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot read or mutate a complaint from another society by id", async () => {
    const ctxB = await ctxFor(adminB, slugB);
    await expect(complaintService.get(ctxB, complaintA)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(complaintService.acknowledge(ctxB, complaintA)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(complaintService.comment(ctxB, { complaintId: complaintA, note: "hi" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await db.complaint.findUniqueOrThrow({ where: { id: complaintA } })).status).toBe("NEW");
  });

  it("cannot attach records to another society's building or unit", async () => {
    const ctxB = await ctxFor(adminB, slugB);
    await expect(societyService.createUnit(ctxB, { buildingId: buildingA, unitNumber: "X1", floor: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      societyService.inviteMember(ctxB, { name: "Eve", email: "eve@example.test", role: "RESIDENT", unitId: unitA }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      complaintService.create(ctxB, { category: "OTHER", title: "Spoof", description: "cross tenant unit", unitId: unitA }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cannot assign a member from another society", async () => {
    const ctxA = await ctxFor(adminA, slugA);
    const memberB = await db.societyMember.findFirstOrThrow({ where: { userId: adminB } });
    await expect(complaintService.assign(ctxA, { complaintId: complaintA, assigneeId: memberB.id })).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("audit log only returns own society rows", async () => {
    const ctxB = await ctxFor(adminB, slugB);
    const { items } = await activityService.listAudit(ctxB, {});
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.societyId !== null && i.entityId !== complaintA)).toBe(true);
    expect(items.every((i) => i.societyId === ctxB.societyId)).toBe(true);
  });
});
