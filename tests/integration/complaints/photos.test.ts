import { rm } from "node:fs/promises";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { authService } from "@/server/services/authService";
import { complaintService } from "@/server/services/complaintService";
import { attachmentService } from "@/server/services/attachmentService";
import { MAX_PHOTOS_PER_COMPLAINT } from "@/lib/storage/images";

const jpeg = (size = 1024) => {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const tokenFrom = (url: string) => url.split("/invite/")[1] ?? "";
const asUser = async (id: string) => {
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  return { id: u.id, email: u.email, name: u.name, emailVerified: true, sessionId: "t" };
};

describe("complaint photos", () => {
  let slug = "";
  let adminId = "";
  let residentId = "";
  let neighbourId = "";
  let complaintId = "";

  beforeAll(async () => {
    await resetDb();
    await rm(path.resolve(".storage/test"), { recursive: true, force: true });
    const admin = await makeUser("Admin");
    adminId = admin.id;
    slug = (await societyService.createSociety(sessionUser(admin), { name: "Photo Park", address: "1 Lens Road", city: "Pune", state: "MH" })).slug;
    const ctx = await ctxFor(adminId, slug);
    const b = await societyService.createBuilding(ctx, { name: "A", code: "A", floors: 3 });
    const u1 = await societyService.createUnit(ctx, { buildingId: b.id, unitNumber: "A-1", floor: 1 });
    const u2 = await societyService.createUnit(ctx, { buildingId: b.id, unitNumber: "A-2", floor: 1 });
    const join = async (email: string, unitId: string) =>
      (await authService.acceptInvite({ token: tokenFrom((await societyService.inviteMember(ctx, { name: email, email, role: "RESIDENT", unitId })).inviteUrl), password: "long-pass-1234" })).userId;
    residentId = await join("r@example.test", u1.id);
    neighbourId = await join("n@example.test", u2.id);
    const resident = await ctxFor(residentId, slug);
    complaintId = (await complaintService.create(resident, { category: "CIVIL", title: "Crack in wall", description: "Big crack near window", unitId: u1.id })).id;
  });

  it("resident adds a photo; it downloads for people who can see the complaint", async () => {
    const resident = await ctxFor(residentId, slug);
    const asset = await attachmentService.addComplaintPhoto(resident, { complaintId }, { name: "wall.jpg", bytes: jpeg() });
    expect(asset.mimeType).toBe("image/jpeg");
    expect(asset.storageKey.startsWith(`${resident.societyId}/complaints/${complaintId}/`)).toBe(true);

    const file = await attachmentService.openFile(await asUser(residentId), asset.id);
    expect(file.bytes.length).toBe(1024);
    await expect(attachmentService.openFile(await asUser(adminId), asset.id)).resolves.toBeTruthy();
    expect(await db.auditLog.count({ where: { action: "complaint.photo_added" } })).toBe(1);
  });

  it("other residents and other societies get NOT_FOUND", async () => {
    const asset = await db.fileAsset.findFirstOrThrow();
    await expect(attachmentService.openFile(await asUser(neighbourId), asset.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const outsider = await makeUser("Outsider");
    await societyService.createSociety(sessionUser(outsider), { name: "Elsewhere", address: "2 Road", city: "Pune", state: "MH" });
    await expect(attachmentService.openFile(await asUser(outsider.id), asset.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(attachmentService.openFile(await asUser(adminId), "not-a-uuid")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects non-images, empty and oversized files", async () => {
    const resident = await ctxFor(residentId, slug);
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");
    await expect(attachmentService.addComplaintPhoto(resident, { complaintId }, { name: "x.jpg", bytes: svg })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(attachmentService.addComplaintPhoto(resident, { complaintId }, { name: "x.jpg", bytes: new Uint8Array() })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(attachmentService.addComplaintPhoto(resident, { complaintId }, { name: "big.jpg", bytes: jpeg(4 * 1024 * 1024 + 1) })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("neighbours cannot attach to someone else's complaint", async () => {
    const neighbour = await ctxFor(neighbourId, slug);
    await expect(attachmentService.addComplaintPhoto(neighbour, { complaintId }, { name: "x.jpg", bytes: jpeg() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("caps photos per complaint", async () => {
    const resident = await ctxFor(residentId, slug);
    const have = await db.complaintAttachment.count({ where: { complaintId } });
    for (let i = have; i < MAX_PHOTOS_PER_COMPLAINT; i++) {
      await attachmentService.addComplaintPhoto(resident, { complaintId }, { name: `p${i}.jpg`, bytes: jpeg() });
    }
    await expect(attachmentService.addComplaintPhoto(resident, { complaintId }, { name: "one-more.jpg", bytes: jpeg() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
