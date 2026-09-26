import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";
import { allowedComplaintActions } from "@/features/complaints/permissions";

describe("role permissions", () => {
  it("residents can raise but not assign or view all", () => {
    expect(can(["RESIDENT"], "complaint.create")).toBe(true);
    expect(can(["RESIDENT"], "complaint.assign")).toBe(false);
    expect(can(["RESIDENT"], "complaint.view_all")).toBe(false);
  });

  it("staff cannot invite or assign", () => {
    expect(can(["STAFF"], "member.invite")).toBe(false);
    expect(can(["STAFF"], "complaint.assign")).toBe(false);
    expect(can(["STAFF"], "complaint.resolve")).toBe(true);
  });

  it("only admin can update society settings", () => {
    expect(can(["SOCIETY_ADMIN"], "society.update")).toBe(true);
    expect(can(["SOCIETY_MANAGER"], "society.update")).toBe(false);
  });
});

describe("allowedComplaintActions", () => {
  const resident = { roles: ["RESIDENT"] as const, memberIds: ["r1"] };
  const staff = { roles: ["STAFF"] as const, memberIds: ["s1"] };
  it("resident sees confirm only when resolved", () => {
    expect(allowedComplaintActions(resident, { status: "RESOLVED", raisedById: "r1", assigneeId: "s1" }).decide).toBe(true);
    expect(allowedComplaintActions(resident, { status: "IN_PROGRESS", raisedById: "r1", assigneeId: "s1" }).decide).toBe(false);
  });
  it("staff can only work on own assignments", () => {
    expect(allowedComplaintActions(staff, { status: "ASSIGNED", raisedById: "r1", assigneeId: "s1" }).start).toBe(true);
    expect(allowedComplaintActions(staff, { status: "ASSIGNED", raisedById: "r1", assigneeId: "s2" }).start).toBe(false);
  });
});
