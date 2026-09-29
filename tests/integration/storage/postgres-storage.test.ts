import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../support/db";
import { PostgresStorage } from "@/lib/storage";

const storage = new PostgresStorage();
const bytes = (...b: number[]) => new Uint8Array(b);

describe("PostgresStorage", () => {
  beforeEach(async () => {
    await db.fileBlob.deleteMany();
  });

  it("stores and returns the exact bytes", async () => {
    await storage.put("s/abc/photo.jpg", bytes(0xff, 0xd8, 0x00, 0x7f), "image/jpeg");
    expect(await storage.get("s/abc/photo.jpg")).toEqual(bytes(0xff, 0xd8, 0x00, 0x7f));
  });

  it("returns null for a missing key", async () => {
    expect(await storage.get("s/abc/missing.jpg")).toBeNull();
  });

  it("overwrites on a retried put instead of failing", async () => {
    await storage.put("s/abc/photo.jpg", bytes(1), "image/jpeg");
    await storage.put("s/abc/photo.jpg", bytes(2), "image/jpeg");
    expect(await storage.get("s/abc/photo.jpg")).toEqual(bytes(2));
    expect(await db.fileBlob.count()).toBe(1);
  });

  it("deletes, and deleting twice is harmless", async () => {
    await storage.put("s/abc/photo.jpg", bytes(1), "image/jpeg");
    await storage.delete("s/abc/photo.jpg");
    await storage.delete("s/abc/photo.jpg");
    expect(await storage.get("s/abc/photo.jpg")).toBeNull();
  });

  it("rejects unsafe keys", async () => {
    await expect(storage.put("../etc/passwd", bytes(1), "image/jpeg")).rejects.toThrow("Unsafe storage key");
    await expect(storage.get("/abs/path")).rejects.toThrow("Unsafe storage key");
  });
});
