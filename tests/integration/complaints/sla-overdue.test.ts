import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { adminService } from "@/server/services/adminService";
import { complaintService } from "@/server/services/complaintService";
import { runOverdueComplaintAlerts } from "@/server/jobs/overdueComplaints";

const base = { name: "Sla Society", address: "1 Clock Road", city: "Pune", state: "MH" };

describe("SLA settings and overdue alerts", () => {
  let slug = "";
  let adminId = "";

  beforeAll(async () => {
    await resetDb();
    const admin = await makeUser("Admin");
    adminId = admin.id;
    slug = (await societyService.createSociety(sessionUser(admin), base)).slug;
  });

  it("uses the society's SLA hours for new complaints", async () => {
    const ctx = await ctxFor(adminId, slug);
    await adminService.updateSociety(ctx, { ...base, slaCriticalHours: 2, slaHighHours: 6, slaNormalHours: 24, slaLowHours: 96 });
    const c = await complaintService.create(ctx, { category: "LIFT", title: "Lift stuck", description: "Stuck between floors", priority: "CRITICAL" });
    const hours = (c.dueAt.getTime() - c.createdAt.getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(2);
  });

  it("rejects SLA where urgent priorities get more time", async () => {
    const ctx = await ctxFor(adminId, slug);
    await expect(adminService.updateSociety(ctx, { ...base, slaCriticalHours: 50, slaHighHours: 6, slaNormalHours: 24, slaLowHours: 96 })).rejects.toThrow();
  });

  it("alerts once per overdue complaint, to managers when unassigned", async () => {
    const ctx = await ctxFor(adminId, slug);
    const c = await complaintService.create(ctx, { category: "WATER", title: "No water", description: "No water in the kitchen" });
    await db.complaint.update({ where: { id: c.id }, data: { dueAt: new Date(Date.now() - 60_000) } });
    const closed = await complaintService.create(ctx, { category: "OTHER", title: "Old issue", description: "Already handled one" });
    await db.complaint.update({ where: { id: closed.id }, data: { dueAt: new Date(Date.now() - 60_000), status: "CLOSED" } });

    const [a, b] = await Promise.all([runOverdueComplaintAlerts(), runOverdueComplaintAlerts()]);
    expect(a.alerted + b.alerted).toBe(1);
    expect((await runOverdueComplaintAlerts()).alerted).toBe(0);
    const notes = await db.notification.findMany({ where: { userId: adminId, template: "complaint.overdue" } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.title).toContain(`#${c.number}`);
  });

  it("only admins change settings", async () => {
    const ctx = await ctxFor(adminId, slug);
    const member = await db.societyMember.findFirstOrThrow({ where: { userId: adminId } });
    await db.societyMember.update({ where: { id: member.id }, data: { role: "SOCIETY_MANAGER" } });
    const manager = await ctxFor(adminId, slug);
    await expect(adminService.updateSociety(manager, { ...base, slaCriticalHours: 1, slaHighHours: 2, slaNormalHours: 3, slaLowHours: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.societyMember.update({ where: { id: member.id }, data: { role: "SOCIETY_ADMIN" } });
    void ctx;
  });
});
