import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { authorize, type SocietyContext } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";
import { MAX_CSV_BYTES, summarize, unitKey, validateUnitCsv, type ImportContext } from "@/features/society/csv-import";

const inputSchema = z.object({ csv: z.string().max(MAX_CSV_BYTES * 2, "File is too large.") });

async function loadContext(societyId: string): Promise<ImportContext> {
  const buildings = await db.building.findMany({
    where: { societyId },
    select: { id: true, code: true, floors: true, name: true, units: { select: { unitNumber: true } } },
  });
  return {
    buildings: new Map(buildings.map((b) => [b.code.toUpperCase(), { id: b.id, floors: b.floors, name: b.name }])),
    existing: new Set(buildings.flatMap((b) => b.units.map((u) => unitKey(b.id, u.unitNumber)))),
  };
}

function validate(ctx: ImportContext, csv: string) {
  const outcome = validateUnitCsv(csv, ctx);
  if (!outcome.ok) throw new AppError("VALIDATION", outcome.error, { csv: [outcome.error] });
  return outcome.rows;
}

export const unitImportService = {
  /** Dry run: nothing is written. */
  async preview(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "unit.manage");
    const { csv } = inputSchema.parse(raw);
    const rows = validate(await loadContext(ctx.societyId), csv);
    return { rows: rows.map(({ line, status, errors, raw: r }) => ({ line, status, errors, raw: r })), summary: summarize(rows) };
  },

  /**
   * Re-validates on the server (never trusts the preview), then inserts only valid rows in one
   * transaction. Rows added by someone else since the preview are skipped, not duplicated.
   */
  async commit(ctx: SocietyContext, raw: unknown) {
    authorize(ctx, "unit.manage");
    const { csv } = inputSchema.parse(raw);
    const rows = validate(await loadContext(ctx.societyId), csv);
    const valid = rows.flatMap((r) => (r.status === "valid" && r.data ? [r.data] : []));
    if (valid.length === 0) throw new AppError("VALIDATION", "There are no valid rows to import.");
    const created = await db.$transaction(async (tx) => {
      const res = await tx.unit.createMany({
        data: valid.map((v) => ({ ...v, societyId: ctx.societyId })),
        skipDuplicates: true,
      });
      await audit.log(tx, {
        societyId: ctx.societyId,
        actorId: ctx.user.id,
        action: "unit.imported",
        entityType: "Society",
        entityId: ctx.societyId,
        after: { imported: res.count, skipped: rows.length - res.count },
      });
      return res.count;
    });
    return { imported: created, skipped: rows.length - created };
  },
};
