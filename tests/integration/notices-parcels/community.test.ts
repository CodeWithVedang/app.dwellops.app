import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { authService } from "@/server/services/authService";
import { noticeService } from "@/server/services/noticeService";
import { parcelService } from "@/server/services/parcelService";

const tokenFrom = (url: string) => url.split("/invite/")[1] ?? "";

describe("notice board and parcel desk", () => {
  let slug = "";
  let adminId = "";
  let residentA = "";
  let residentB = "";
  let guardId = "";
  let unitA = "";
  let buildingA = "";

  beforeAll(async () => {
    await resetDb();
    const admin = await makeUser("Meera");
    adminId = admin.id;
    slug = (await societyService.createSociety(sessionUser(admin), { name: "Lake View", address: "5 Lake Road", city: "Pune", state: "MH" })).slug;
    const ctx = await ctxFor(adminId, slug);
    buildingA = (await societyService.createBuilding(ctx, { name: "Tower A", code: "A", floors: 4 })).id;
    const buildingB = (await societyService.createBuilding(ctx, { name: "Tower B", code: "B", floors: 4 })).id;
    unitA = (await societyService.createUnit(ctx, { buildingId: buildingA, unitNumber: "A-101", floor: 1 })).id;
    const unitB = (await societyService.createUnit(ctx, { buildingId: buildingB, unitNumber: "B-101", floor: 1 })).id;
    const join = async (name: string, email: string, role: "RESIDENT" | "SECURITY_MANAGER", unitId?: string) => {
      const inv = await societyService.inviteMember(ctx, { name, email, role, unitId });
      return (await authService.acceptInvite({ token: tokenFrom(inv.inviteUrl), password: "long-enough-pass" })).userId;
    };
    residentA = await join("Anil", "anil@example.test", "RESIDENT", unitA);
    residentB = await join("Bina", "bina@example.test", "RESIDENT", unitB);
    guardId = await join("Gopal", "gopal@example.test", "SECURITY_MANAGER");
  });

  describe("notices", () => {
    it("targets a building, notifies only its residents and tracks confirmation", async () => {
      const admin = await ctxFor(adminId, slug);
      const n = await noticeService.create(admin, {
        title: "Water cut in Tower A",
        body: "Tank cleaning on Sunday 10am-2pm.",
        category: "WATER",
        audience: "BUILDING",
        buildingId: buildingA,
        requiresAck: "on",
      });
      expect(n.status).toBe("PUBLISHED");

      const a = await ctxFor(residentA, slug);
      const b = await ctxFor(residentB, slug);
      expect((await noticeService.list(a, {})).map((x) => x.id)).toContain(n.id);
      expect((await noticeService.list(b, {})).map((x) => x.id)).not.toContain(n.id);
      await expect(noticeService.get(b, n.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

      expect(await db.notification.count({ where: { userId: residentA, template: "notice.published" } })).toBe(1);
      expect(await db.notification.count({ where: { userId: residentB, template: "notice.published" } })).toBe(0);

      expect(await noticeService.unreadCount(a)).toBe(1);
      await noticeService.acknowledge(a, { noticeId: n.id });
      expect(await noticeService.unreadCount(a)).toBe(0);

      const stats = await noticeService.stats(admin, n.id);
      expect(stats.total).toBe(1);
      expect(stats.acknowledged).toBe(1);
    });

    it("residents cannot post or see drafts", async () => {
      const a = await ctxFor(residentA, slug);
      await expect(noticeService.create(a, { title: "Party tonight", body: "Loud music on the terrace" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const admin = await ctxFor(adminId, slug);
      const draft = await noticeService.create(admin, { title: "Draft rules", body: "Parking rules draft for review", intent: "draft" });
      await expect(noticeService.get(a, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await noticeService.publish(admin, { noticeId: draft.id });
      await expect(noticeService.publish(admin, { noticeId: draft.id })).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("building audience requires a building from this society", async () => {
      const admin = await ctxFor(adminId, slug);
      await expect(noticeService.create(admin, { title: "Lift work", body: "Lift maintenance on Friday", audience: "BUILDING" })).rejects.toThrow();
    });
  });

  describe("parcels", () => {
    it("logs, hides the code from the gate, and hands over only with the right code", async () => {
      const guard = await ctxFor(guardId, slug);
      const resident = await ctxFor(residentA, slug);
      const p = await parcelService.log(guard, { unitId: unitA, courier: "Amazon", storageLocation: "Rack 1" });
      expect(p.status).toBe("NOTIFIED");
      expect(p.notified).toBe(1);

      const gateView = await parcelService.list(guard, {});
      expect(gateView.find((x) => x.id === p.id)?.pickupCode).toBeNull();
      const mine = await parcelService.list(resident, {});
      const code = mine.find((x) => x.id === p.id)?.pickupCode;
      expect(code).toMatch(/^\d{4}$/);

      const wrong = code === "0000" ? "1111" : "0000";
      await expect(parcelService.handover(guard, { parcelId: p.id, code: wrong, collectedByName: "Anil" })).rejects.toMatchObject({ code: "VALIDATION" });
      await parcelService.handover(guard, { parcelId: p.id, code: code!, collectedByName: "Anil" });
      await expect(parcelService.handover(guard, { parcelId: p.id, code: code!, collectedByName: "Anil" })).rejects.toMatchObject({ code: "CONFLICT" });

      const done = await db.parcel.findUniqueOrThrow({ where: { id: p.id } });
      expect(done.status).toBe("COLLECTED");
      expect(done.collectedByName).toBe("Anil");
      expect(await db.notification.count({ where: { userId: residentA, template: "parcel.collected" } })).toBe(1);
    });

    it("residents only see their own flat's parcels and cannot log or hand over", async () => {
      const guard = await ctxFor(guardId, slug);
      const b = await ctxFor(residentB, slug);
      await parcelService.log(guard, { unitId: unitA, courier: "Flipkart" });
      expect((await parcelService.list(b, { view: "all" })).length).toBe(0);
      await expect(parcelService.log(b, { unitId: unitA, courier: "Fake" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rate-limits repeated wrong codes", async () => {
      const guard = await ctxFor(guardId, slug);
      const p = await parcelService.log(guard, { unitId: unitA, courier: "DTDC" });
      const real = (await db.parcel.findUniqueOrThrow({ where: { id: p.id } })).pickupCode;
      const wrong = real === "9999" ? "8888" : "9999";
      for (let i = 0; i < 5; i++) {
        await expect(parcelService.handover(guard, { parcelId: p.id, code: wrong, collectedByName: "X Y" })).rejects.toMatchObject({ code: "VALIDATION" });
      }
      await expect(parcelService.handover(guard, { parcelId: p.id, code: real, collectedByName: "X Y" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    });

    it("another society's guard cannot touch these parcels", async () => {
      const other = await makeUser("Outsider");
      const otherSlug = (await societyService.createSociety(sessionUser(other), { name: "Other Place", address: "9 Road", city: "Pune", state: "MH" })).slug;
      const outsider = await ctxFor(other.id, otherSlug);
      const guard = await ctxFor(guardId, slug);
      const p = await parcelService.log(guard, { unitId: unitA, courier: "Blue Dart" });
      await expect(parcelService.log(outsider, { unitId: unitA, courier: "Spoof" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(parcelService.handover(outsider, { parcelId: p.id, code: "0000", collectedByName: "Thief" })).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await parcelService.list(outsider, { view: "all" })).length).toBe(0);
    });
  });
});
