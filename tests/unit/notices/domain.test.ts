import { describe, expect, it } from "vitest";
import { noticeReaches, noticeState } from "@/features/notices/domain";

const resident = { roles: ["RESIDENT"] as const, buildingIds: ["bA"], relations: ["OWNER"] as const };
const tenant = { roles: ["TENANT"] as const, buildingIds: ["bB"], relations: ["TENANT"] as const };
const guard = { roles: ["SECURITY_MANAGER"] as const, buildingIds: [], relations: [] };
const committee = { roles: ["COMMITTEE_MEMBER"] as const, buildingIds: [], relations: [] };

describe("noticeReaches", () => {
  it("ALL reaches everyone", () => {
    for (const m of [resident, tenant, guard, committee]) expect(noticeReaches({ audience: "ALL", buildingId: null }, m)).toBe(true);
  });

  it("BUILDING reaches only that building's residents", () => {
    expect(noticeReaches({ audience: "BUILDING", buildingId: "bA" }, resident)).toBe(true);
    expect(noticeReaches({ audience: "BUILDING", buildingId: "bA" }, tenant)).toBe(false);
    expect(noticeReaches({ audience: "BUILDING", buildingId: null }, resident)).toBe(false);
  });

  it("OWNERS vs TENANTS are separated", () => {
    expect(noticeReaches({ audience: "OWNERS", buildingId: null }, resident)).toBe(true);
    expect(noticeReaches({ audience: "OWNERS", buildingId: null }, tenant)).toBe(false);
    expect(noticeReaches({ audience: "TENANTS", buildingId: null }, tenant)).toBe(true);
    expect(noticeReaches({ audience: "TENANTS", buildingId: null }, resident)).toBe(false);
  });

  it("COMMITTEE and STAFF are role based", () => {
    expect(noticeReaches({ audience: "COMMITTEE", buildingId: null }, committee)).toBe(true);
    expect(noticeReaches({ audience: "COMMITTEE", buildingId: null }, resident)).toBe(false);
    expect(noticeReaches({ audience: "STAFF", buildingId: null }, guard)).toBe(true);
    expect(noticeReaches({ audience: "STAFF", buildingId: null }, resident)).toBe(false);
  });
});

describe("noticeState", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("derives display state", () => {
    expect(noticeState({ status: "DRAFT", expiresAt: null }, now)).toBe("DRAFT");
    expect(noticeState({ status: "PUBLISHED", expiresAt: null }, now)).toBe("LIVE");
    expect(noticeState({ status: "PUBLISHED", expiresAt: new Date("2026-05-01T00:00:00Z") }, now)).toBe("EXPIRED");
    expect(noticeState({ status: "ARCHIVED", expiresAt: null }, now)).toBe("ARCHIVED");
  });
});
