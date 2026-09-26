import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { authService } from "@/server/services/authService";
import { complaintService } from "@/server/services/complaintService";
import { AppError } from "@/lib/errors";

const tokenFrom = (url: string) => url.split("/invite/")[1] ?? "";

describe("vertical slice: society → complaint → closure", () => {
  let slug = "";
  let adminId = "";
  let residentUserId = "";
  let staffUserId = "";
  let unitId = "";

  beforeAll(async () => {
    await resetDb();
    const admin = await makeUser("Asha");
    adminId = admin.id;
    slug = (
      await societyService.createSociety(sessionUser(admin), { name: "Green Meadows", address: "12 MG Road", city: "Pune", state: "MH" })
    ).slug;
    const ctx = await ctxFor(adminId, slug);
    const building = await societyService.createBuilding(ctx, { name: "Wing A", code: "a", floors: 5 });
    expect(building.code).toBe("A");
    unitId = (await societyService.createUnit(ctx, { buildingId: building.id, unitNumber: "A-101", floor: 1 })).id;

    const resInvite = await societyService.inviteMember(ctx, { name: "Ravi", email: "ravi@example.test", role: "RESIDENT", unitId });
    residentUserId = (await authService.acceptInvite({ token: tokenFrom(resInvite.inviteUrl), password: "resident-pass-123" })).userId;

    const staffInvite = await societyService.inviteMember(ctx, { name: "Sunil", email: "sunil@example.test", role: "STAFF" });
    staffUserId = (await authService.acceptInvite({ token: tokenFrom(staffInvite.inviteUrl), password: "staff-pass-1234" })).userId;
  });

  it("rejects duplicate unit numbers in the same building", async () => {
    const ctx = await ctxFor(adminId, slug);
    const b = await db.building.findFirstOrThrow({ where: { code: "A" } });
    await expect(societyService.createUnit(ctx, { buildingId: b.id, unitNumber: "A-101", floor: 1 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("requires a unit when inviting a resident", async () => {
    const ctx = await ctxFor(adminId, slug);
    await expect(societyService.inviteMember(ctx, { name: "No Unit", email: "nounit@example.test", role: "RESIDENT" })).rejects.toThrow();
  });

  it("invite tokens are single-use", async () => {
    const ctx = await ctxFor(adminId, slug);
    const inv = await societyService.inviteMember(ctx, { name: "Tara", email: "tara@example.test", role: "TENANT", unitId });
    await authService.acceptInvite({ token: tokenFrom(inv.inviteUrl), password: "tenant-pass-123" });
    await expect(authService.acceptInvite({ token: tokenFrom(inv.inviteUrl), password: "tenant-pass-123" })).rejects.toBeInstanceOf(AppError);
  });

  it("login rejects wrong password with a generic message", async () => {
    await expect(authService.login({ email: "ravi@example.test", password: "wrong-password" })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Email or password is incorrect.",
    });
    await expect(authService.login({ email: "nobody@example.test", password: "whatever-123" })).rejects.toMatchObject({
      message: "Email or password is incorrect.",
    });
    expect((await authService.login({ email: "ravi@example.test", password: "resident-pass-123" })).userId).toBe(residentUserId);
  });

  it("runs the full complaint lifecycle with history, audit and notifications", async () => {
    const resident = await ctxFor(residentUserId, slug);
    const manager = await ctxFor(adminId, slug);
    const staff = await ctxFor(staffUserId, slug);

    const c = await complaintService.create(resident, {
      category: "PLUMBING",
      title: "Kitchen tap leaking",
      description: "Water drips all night.",
      priority: "HIGH",
      unitId,
    });
    expect(c.number).toBe(1);
    expect(c.status).toBe("NEW");

    // Manager sees it; unassigned staff does not.
    expect((await complaintService.list(manager, {})).total).toBe(1);
    expect((await complaintService.list(staff, {})).total).toBe(0);

    const staffMember = await db.societyMember.findFirstOrThrow({ where: { userId: staffUserId } });
    await expect(complaintService.assign(staff, { complaintId: c.id, assigneeId: staffMember.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await complaintService.acknowledge(manager, c.id);
    await complaintService.assign(manager, { complaintId: c.id, assigneeId: staffMember.id });
    expect((await complaintService.list(staff, {})).total).toBe(1);

    await expect(complaintService.resolve(resident, { complaintId: c.id, resolutionNote: "done done" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(complaintService.resolve(staff, { complaintId: c.id, resolutionNote: "Replaced washer" })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });

    await complaintService.updateStatus(staff, { complaintId: c.id, status: "IN_PROGRESS" });
    await complaintService.resolve(staff, { complaintId: c.id, resolutionNote: "Replaced washer", cost: "250.50" });

    await expect(complaintService.residentDecision(resident, { complaintId: c.id, decision: "REOPEN" })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await complaintService.residentDecision(resident, { complaintId: c.id, decision: "CONFIRM" });

    const final = await complaintService.get(manager, c.id);
    expect(final.status).toBe("CLOSED");
    expect(final.resolutionCostPaise).toBe(25050);
    expect(final.activities.map((a) => a.toStatus)).toEqual(["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

    const audits = await db.auditLog.findMany({ where: { entityId: c.id }, orderBy: { createdAt: "asc" } });
    expect(audits.map((a) => a.action)).toEqual([
      "complaint.created",
      "complaint.acknowledged",
      "complaint.assigned",
      "complaint.in_progress",
      "complaint.resolved",
      "complaint.closed",
    ]);

    const staffNotes = await db.notification.findMany({ where: { userId: staffUserId } });
    expect(staffNotes.some((n) => n.template === "complaint.assigned")).toBe(true);
    const residentNotes = await db.notification.findMany({ where: { userId: residentUserId } });
    expect(residentNotes.some((n) => n.template === "complaint.resolved")).toBe(true);
  });

  it("resident can reopen with a reason, and it can be reassigned", async () => {
    const resident = await ctxFor(residentUserId, slug);
    const manager = await ctxFor(adminId, slug);
    const staff = await ctxFor(staffUserId, slug);
    const staffMember = await db.societyMember.findFirstOrThrow({ where: { userId: staffUserId } });
    const c = await complaintService.create(resident, { category: "ELECTRICAL", title: "Switch sparks", description: "Bedroom switch sparks", unitId });
    await complaintService.assign(manager, { complaintId: c.id, assigneeId: staffMember.id });
    await complaintService.updateStatus(staff, { complaintId: c.id, status: "IN_PROGRESS" });
    await complaintService.resolve(staff, { complaintId: c.id, resolutionNote: "Replaced switch" });
    await complaintService.residentDecision(resident, { complaintId: c.id, decision: "REOPEN", note: "Still sparks" });
    expect((await complaintService.get(manager, c.id)).status).toBe("REOPENED");
    await complaintService.assign(manager, { complaintId: c.id, assigneeId: staffMember.id });
    expect((await complaintService.get(manager, c.id)).status).toBe("ASSIGNED");
  });

  it("allows only one of two concurrent identical transitions", async () => {
    const manager = await ctxFor(adminId, slug);
    const c = await complaintService.create(manager, { category: "LIFT", title: "Lift stuck", description: "Lift B stuck at 3rd floor" });
    await Promise.allSettled([complaintService.acknowledge(manager, c.id), complaintService.acknowledge(manager, c.id)]);
    const acks = await db.complaintActivity.count({ where: { complaintId: c.id, toStatus: "ACKNOWLEDGED" } });
    expect(acks).toBe(1);
  });

  it("audit rows cannot be updated", async () => {
    const row = await db.auditLog.findFirstOrThrow();
    await expect(db.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } })).rejects.toThrow();
  });
});
