import { beforeAll, describe, expect, it } from "vitest";
import { ctxFor, db, makeUser, resetDb, sessionUser } from "../../support/db";
import { societyService } from "@/server/services/societyService";
import { unitImportService } from "@/server/services/unitImportService";
import { authService } from "@/server/services/authService";

const CSV = ["building_code,unit_number,floor,unit_type,area_sqft", "A,A-101,1,2BHK,950", "A,A-102,1,,", "A,A-102,1,,", "Q,Q-1,1,,"].join("\n");

describe("CSV unit import", () => {
  let slug = "";
  let adminId = "";

  beforeAll(async () => {
    await resetDb();
    const admin = await makeUser("Kiran");
    adminId = admin.id;
    slug = (await societyService.createSociety(sessionUser(admin), { name: "Palm Grove", address: "3 Palm Road", city: "Pune", state: "MH" })).slug;
    const ctx = await ctxFor(adminId, slug);
    await societyService.createBuilding(ctx, { name: "Wing A", code: "A", floors: 4 });
  });

  it("preview writes nothing", async () => {
    const ctx = await ctxFor(adminId, slug);
    const p = await unitImportService.preview(ctx, { csv: CSV });
    expect(p.summary).toEqual({ valid: 2, invalid: 1, duplicate: 1, missing: 0 });
    expect(await db.unit.count()).toBe(0);
  });

  it("imports only valid rows, audits once, and re-validates on repeat", async () => {
    const ctx = await ctxFor(adminId, slug);
    expect(await unitImportService.commit(ctx, { csv: CSV })).toEqual({ imported: 2, skipped: 2 });
    const units = await db.unit.findMany({ orderBy: { unitNumber: "asc" } });
    expect(units.map((u) => u.unitNumber)).toEqual(["A-101", "A-102"]);
    expect(units[0]!.areaSqft).toBe(950);
    expect(await db.auditLog.count({ where: { action: "unit.imported" } })).toBe(1);

    // Same file again: everything is now a duplicate, nothing to import.
    await expect(unitImportService.commit(ctx, { csv: CSV })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.unit.count()).toBe(2);
  });

  it("residents cannot import", async () => {
    const admin = await ctxFor(adminId, slug);
    const unit = await db.unit.findFirstOrThrow();
    const inv = await societyService.inviteMember(admin, { name: "Res", email: "res@example.test", role: "RESIDENT", unitId: unit.id });
    const { userId } = await authService.acceptInvite({ token: inv.inviteUrl.split("/invite/")[1]!, password: "resident-pass-1" });
    const resident = await ctxFor(userId, slug);
    await expect(unitImportService.preview(resident, { csv: CSV })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(unitImportService.commit(resident, { csv: CSV })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("building codes resolve only inside the caller's society", async () => {
    const other = await makeUser("Other");
    const otherSlug = (await societyService.createSociety(sessionUser(other), { name: "Other Estate", address: "8 Road", city: "Pune", state: "MH" })).slug;
    const ctx = await ctxFor(other.id, otherSlug);
    const p = await unitImportService.preview(ctx, { csv: "building_code,unit_number,floor\nA,A-900,1" });
    expect(p.summary.invalid).toBe(1);
  });
});
