import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { authService } from "@/server/services/authService";
import { adminService } from "@/server/services/adminService";
import { complaintService } from "@/server/services/complaintService";

const tokenFrom = (url: string) => url.split("/invite/")[1] ?? "";

describe("admin edit / delete", () => {
  let slug = "";
  let adminId = "";
  let buildingId = "";
  let emptyUnitId = "";
  let busyUnitId = "";
  let residentId = "";

  beforeAll(async () => {
    await resetDb();
    const admin = await makeUser("Admin");
    adminId = admin.id;
    slug = (await societyService.createSociety(sessionUser(admin), { name: "Edit Estate", address: "1 Road", city: "Pune", state: "MH" })).slug;
    const ctx = await ctxFor(adminId, slug);
    buildingId = (await societyService.createBuilding(ctx, { name: "Wing A", code: "A", floors: 5 })).id;
    emptyUnitId = (await societyService.createUnit(ctx, { buildingId, unitNumber: "A-1", floor: 1 })).id;
    busyUnitId = (await societyService.createUnit(ctx, { buildingId, unitNumber: "A-4", floor: 4 })).id;
    const inv = await societyService.inviteMember(ctx, { name: "Res", email: "res@example.test", role: "RESIDENT", unitId: busyUnitId });
    residentId = (await authService.acceptInvite({ token: tokenFrom(inv.inviteUrl), password: "resident-pass-1" })).userId;
  });

  it("edits a building but not below its highest flat, and blocks code clashes", async () => {
    const ctx = await ctxFor(adminId, slug);
    await adminService.updateBuilding(ctx, { buildingId, name: "Tower A", code: "TA", floors: 6 });
    expect((await db.building.findUniqueOrThrow({ where: { id: buildingId } })).name).toBe("Tower A");
    await expect(adminService.updateBuilding(ctx, { buildingId, name: "Tower A", code: "TA", floors: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
    await societyService.createBuilding(ctx, { name: "Other", code: "OB", floors: 2 });
    await expect(adminService.updateBuilding(ctx, { buildingId, name: "Tower A", code: "OB", floors: 6 })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("edits a flat and deletes only flats with nothing linked", async () => {
    const ctx = await ctxFor(adminId, slug);
    await adminService.updateUnit(ctx, { unitId: emptyUnitId, unitNumber: "A-101", floor: 1, unitType: "2BHK", areaSqft: "900", occupancy: "VACANT" });
    expect((await db.unit.findUniqueOrThrow({ where: { id: emptyUnitId } })).unitNumber).toBe("A-101");
    await expect(adminService.deleteUnit(ctx, { id: busyUnitId })).rejects.toMatchObject({ code: "CONFLICT" });
    await adminService.deleteUnit(ctx, { id: emptyUnitId });
    expect(await db.unit.findUnique({ where: { id: emptyUnitId } })).toBeNull();
    await expect(adminService.deleteBuilding(ctx, { id: buildingId })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("removing a member keeps their history and blocks access; restore brings it back", async () => {
    const ctx = await ctxFor(adminId, slug);
    const resident = await ctxFor(residentId, slug);
    await complaintService.create(resident, { category: "WATER", title: "Low pressure", description: "Very low water pressure", unitId: busyUnitId });
    const member = await db.societyMember.findFirstOrThrow({ where: { userId: residentId } });
    await adminService.setMemberStatus(ctx, { memberId: member.id, status: "DISABLED" });
    await expect(ctxFor(residentId, slug)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await db.complaint.count({ where: { raisedById: member.id } })).toBe(1);
    await adminService.setMemberStatus(ctx, { memberId: member.id, status: "ACTIVE" });
    await expect(ctxFor(residentId, slug)).resolves.toBeTruthy();
  });

  it("changes roles, but never leaves the society without an admin", async () => {
    const ctx = await ctxFor(adminId, slug);
    const self = await db.societyMember.findFirstOrThrow({ where: { userId: adminId } });
    await expect(adminService.changeRole(ctx, { memberId: self.id, role: "RESIDENT" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(adminService.setMemberStatus(ctx, { memberId: self.id, status: "DISABLED" })).rejects.toMatchObject({ code: "CONFLICT" });
    const member = await db.societyMember.findFirstOrThrow({ where: { userId: residentId } });
    await adminService.changeRole(ctx, { memberId: member.id, role: "COMMITTEE_MEMBER" });
    expect((await db.societyMember.findUniqueOrThrow({ where: { id: member.id } })).role).toBe("COMMITTEE_MEMBER");
  });

  it("revokes pending invites and blocks residents and other societies", async () => {
    const ctx = await ctxFor(adminId, slug);
    const inv = await societyService.inviteMember(ctx, { name: "Late", email: "late@example.test", role: "STAFF" });
    const row = await db.invitation.findFirstOrThrow({ where: { email: "late@example.test" } });
    await adminService.revokeInvite(ctx, { id: row.id });
    await expect(authService.acceptInvite({ token: tokenFrom(inv.inviteUrl), password: "long-pass-1234" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const other = await makeUser("Outsider");
    const otherSlug = (await societyService.createSociety(sessionUser(other), { name: "Elsewhere", address: "9 Road", city: "Pune", state: "MH" })).slug;
    const outsider = await ctxFor(other.id, otherSlug);
    await expect(adminService.deleteUnit(outsider, { id: busyUnitId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(adminService.updateBuilding(outsider, { buildingId, name: "Hijack", code: "HJ", floors: 9 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
