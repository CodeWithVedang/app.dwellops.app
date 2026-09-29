import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/logging/logger", () => ({ logger: { error: vi.fn() } }));

const { pingDatabase } = await import("@/server/services/healthService");

describe("pingDatabase", () => {
  it("reports ok when the query resolves", async () => {
    const result = await pingDatabase(async () => 1);
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports not ok when the query fails", async () => {
    const result = await pingDatabase(() => Promise.reject(new Error("connection refused")));
    expect(result.ok).toBe(false);
  });

  it("reports not ok when the query hangs past the timeout", async () => {
    const result = await pingDatabase(() => new Promise(() => undefined), 20);
    expect(result.ok).toBe(false);
  });
});
