import { describe, expect, it } from "vitest";
import { canTransition, computeDueAt, isOverdue, TRANSITIONS } from "@/features/complaints/domain";

describe("complaint status machine", () => {
  it("allows the documented happy path", () => {
    const path = ["NEW", "ACKNOWLEDGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it("supports waiting and reopen loops", () => {
    expect(canTransition("IN_PROGRESS", "WAITING")).toBe(true);
    expect(canTransition("WAITING", "IN_PROGRESS")).toBe(true);
    expect(canTransition("RESOLVED", "REOPENED")).toBe(true);
    expect(canTransition("REOPENED", "ASSIGNED")).toBe(true);
  });

  it("rejects skipping steps and leaving terminal states", () => {
    expect(canTransition("NEW", "RESOLVED")).toBe(false);
    expect(canTransition("NEW", "CLOSED")).toBe(false);
    expect(canTransition("ASSIGNED", "CLOSED")).toBe(false);
    expect(TRANSITIONS.CLOSED).toHaveLength(0);
    expect(TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it("does not allow cancelling work already in progress", () => {
    expect(canTransition("IN_PROGRESS", "CANCELLED")).toBe(false);
  });
});

describe("SLA", () => {
  const t0 = new Date("2026-01-01T00:00:00Z");
  it("computes due time per priority", () => {
    expect(computeDueAt(t0, "CRITICAL").toISOString()).toBe("2026-01-01T04:00:00.000Z");
    expect(computeDueAt(t0, "NORMAL").toISOString()).toBe("2026-01-03T00:00:00.000Z");
    expect(computeDueAt(t0, "LOW").toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("flags overdue only for open complaints", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    const dueAt = new Date("2026-01-02T00:00:00Z");
    expect(isOverdue({ status: "IN_PROGRESS", dueAt }, now)).toBe(true);
    expect(isOverdue({ status: "RESOLVED", dueAt }, now)).toBe(false);
    expect(isOverdue({ status: "CLOSED", dueAt }, now)).toBe(false);
    expect(isOverdue({ status: "NEW", dueAt: new Date("2026-01-06T00:00:00Z") }, now)).toBe(false);
  });
});
