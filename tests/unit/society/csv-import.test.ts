import { describe, expect, it } from "vitest";
import { parseCsv, summarize, unitKey, validateUnitCsv, type ImportContext } from "@/features/society/csv-import";

const ctx = (): ImportContext => ({
  buildings: new Map([
    ["A", { id: "bA", floors: 5, name: "Wing A" }],
    ["B", { id: "bB", floors: 2, name: "Wing B" }],
  ]),
  existing: new Set([unitKey("bA", "A-101")]),
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n\r\n1,2');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["1", "2"],
    ]);
  });
});

describe("validateUnitCsv", () => {
  it("classifies valid, invalid, duplicate and missing rows", () => {
    const csv = [
      "Building Code,Unit Number,Floor,Unit Type,Area Sqft",
      "A,A-102,1,2BHK,950", // valid
      "a,a-103,0,,", // valid (case-insensitive code, ground floor)
      "A,A-101,1,,", // duplicate: exists in DB
      "A,A-102,1,,", // duplicate: earlier in file
      "Z,Z-1,1,,", // invalid: unknown building
      "B,B-301,3,,", // invalid: floor above building
      "A,A-104,one,,", // invalid: floor not a number
      "A,A-105,1,,-5", // invalid: area
      ",A-106,1,,", // missing building
      "A,,1,,", // missing unit
    ].join("\n");
    const out = validateUnitCsv(csv, ctx());
    if (!out.ok) throw new Error(out.error);
    expect(out.rows.map((r) => r.status)).toEqual([
      "valid",
      "valid",
      "duplicate",
      "duplicate",
      "invalid",
      "invalid",
      "invalid",
      "invalid",
      "missing",
      "missing",
    ]);
    expect(summarize(out.rows)).toEqual({ valid: 2, invalid: 4, duplicate: 2, missing: 2 });
    expect(out.rows[0]!.line).toBe(2);
    expect(out.rows[0]!.data).toEqual({ buildingId: "bA", unitNumber: "A-102", floor: 1, unitType: "2BHK", areaSqft: 950 });
    expect(out.rows[5]!.errors[0]).toMatch(/only 2 floors/);
  });

  it("rejects files without required columns", () => {
    const out = validateUnitCsv("unit_number,floor\nA-1,1", ctx());
    expect(out).toEqual({ ok: false, error: expect.stringMatching(/Missing column: building_code/) });
  });

  it("rejects empty files and header-only files", () => {
    expect(validateUnitCsv("", ctx()).ok).toBe(false);
    expect(validateUnitCsv("building_code,unit_number,floor\n", ctx()).ok).toBe(false);
  });

  it("caps row count", () => {
    const body = Array.from({ length: 2001 }, (_, i) => `A,X-${i},1`).join("\n");
    const out = validateUnitCsv(`building_code,unit_number,floor\n${body}`, ctx());
    expect(out.ok).toBe(false);
  });
});
