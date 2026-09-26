/**
 * CSV unit import: parsing + row validation. Pure functions (no DB) so they are unit-tested
 * and reused for both the preview and the final import (the server re-validates on import).
 */

export const MAX_CSV_BYTES = 1_000_000;
export const MAX_ROWS = 2000;

export const UNIT_CSV_COLUMNS = ["building_code", "unit_number", "floor", "unit_type", "area_sqft"] as const;
export const UNIT_CSV_TEMPLATE = `building_code,unit_number,floor,unit_type,area_sqft
A,A-101,1,2BHK,950
A,A-102,1,3BHK,1250
B,B-001,0,1BHK,
`;

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF/LF, optional BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export type RowStatus = "valid" | "invalid" | "duplicate" | "missing";

export interface UnitRowResult {
  line: number;
  status: RowStatus;
  errors: string[];
  raw: Record<(typeof UNIT_CSV_COLUMNS)[number], string>;
  data?: { buildingId: string; unitNumber: string; floor: number; unitType?: string; areaSqft?: number };
}

export interface ImportContext {
  /** Buildings in this society keyed by upper-case code. */
  buildings: Map<string, { id: string; floors: number; name: string }>;
  /** Existing "BUILDINGID|UNITNUMBER(upper)" keys. */
  existing: Set<string>;
}

export type ParseOutcome = { ok: false; error: string } | { ok: true; rows: UnitRowResult[] };

export const unitKey = (buildingId: string, unitNumber: string) => `${buildingId}|${unitNumber.trim().toUpperCase()}`;

export function validateUnitCsv(text: string, ctx: ImportContext): ParseOutcome {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) return { ok: false, error: "File is larger than 1 MB. Split it into smaller files." };
  const table = parseCsv(text);
  if (table.length === 0) return { ok: false, error: "The file is empty." };

  const header = table[0]!.map(normalizeHeader);
  const index: Partial<Record<(typeof UNIT_CSV_COLUMNS)[number], number>> = {};
  for (const col of UNIT_CSV_COLUMNS) {
    const i = header.indexOf(col);
    if (i >= 0) index[col] = i;
  }
  const missingCols = (["building_code", "unit_number", "floor"] as const).filter((c) => index[c] === undefined);
  if (missingCols.length) return { ok: false, error: `Missing column${missingCols.length > 1 ? "s" : ""}: ${missingCols.join(", ")}. Use the template.` };

  const body = table.slice(1);
  if (body.length === 0) return { ok: false, error: "No rows below the header." };
  if (body.length > MAX_ROWS) return { ok: false, error: `Too many rows (${body.length}). Import at most ${MAX_ROWS} at a time.` };

  const seen = new Set<string>();
  const rows = body.map((cells, i): UnitRowResult => {
    const get = (c: (typeof UNIT_CSV_COLUMNS)[number]) => (index[c] === undefined ? "" : (cells[index[c]!] ?? "").trim());
    const raw = { building_code: get("building_code"), unit_number: get("unit_number"), floor: get("floor"), unit_type: get("unit_type"), area_sqft: get("area_sqft") };
    const line = i + 2;

    const missing = (["building_code", "unit_number", "floor"] as const).filter((c) => raw[c] === "");
    if (missing.length) return { line, raw, status: "missing", errors: missing.map((m) => `${m.replace("_", " ")} is empty`) };

    const errors: string[] = [];
    const building = ctx.buildings.get(raw.building_code.toUpperCase());
    if (!building) errors.push(`no building with code "${raw.building_code}"`);
    if (raw.unit_number.length > 20) errors.push("unit number longer than 20 characters");
    const floor = /^-?\d{1,3}$/.test(raw.floor) ? Number(raw.floor) : NaN;
    if (!Number.isInteger(floor) || floor < 0) errors.push("floor must be a whole number (0 for ground)");
    else if (building && floor > building.floors) errors.push(`${building.name} has only ${building.floors} floors`);
    let areaSqft: number | undefined;
    if (raw.area_sqft) {
      areaSqft = /^\d{1,6}$/.test(raw.area_sqft) ? Number(raw.area_sqft) : NaN;
      if (!Number.isInteger(areaSqft) || areaSqft < 1) errors.push("area must be a whole number of sq ft");
    }
    if (raw.unit_type.length > 40) errors.push("unit type longer than 40 characters");
    if (errors.length || !building) return { line, raw, status: "invalid", errors };

    const key = unitKey(building.id, raw.unit_number);
    if (ctx.existing.has(key)) return { line, raw, status: "duplicate", errors: ["already exists in Nivaso Plus"] };
    if (seen.has(key)) return { line, raw, status: "duplicate", errors: ["appears earlier in this file"] };
    seen.add(key);

    return {
      line,
      raw,
      status: "valid",
      errors: [],
      data: { buildingId: building.id, unitNumber: raw.unit_number, floor, unitType: raw.unit_type || undefined, areaSqft },
    };
  });
  return { ok: true, rows };
}

export function summarize(rows: UnitRowResult[]): Record<RowStatus, number> {
  const s: Record<RowStatus, number> = { valid: 0, invalid: 0, duplicate: 0, missing: 0 };
  for (const r of rows) s[r.status]++;
  return s;
}
