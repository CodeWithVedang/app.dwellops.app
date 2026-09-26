"use client";

import { useRef, useState, useTransition } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { commitUnitImportAction, previewUnitImportAction, type UnitImportPreview } from "@/features/society/mutations";
import { MAX_CSV_BYTES, UNIT_CSV_TEMPLATE, type RowStatus } from "@/features/society/csv-import";

const STATUS: Record<RowStatus, { label: string; cls: string }> = {
  valid: { label: "Ready", cls: "bg-green-50 text-green-700 ring-green-200" },
  invalid: { label: "Invalid", cls: "bg-red-50 text-red-700 ring-red-200" },
  duplicate: { label: "Duplicate", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  missing: { label: "Missing data", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export function UnitImport({ slug }: { slug: string }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<UnitImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ imported: number; skipped: number } | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCsv(null);
    setPreview(null);
    setFileName("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    setDone(null);
    setError(null);
    setPreview(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) return setError("Choose a .csv file. In Excel: File → Save as → CSV.");
    if (file.size > MAX_CSV_BYTES) return setError("File is larger than 1 MB. Split it into smaller files.");
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    start(async () => {
      const r = await previewUnitImportAction(slug, text);
      if (r?.ok) setPreview(r.data);
      else setError(r?.error.message ?? "Couldn't read the file.");
    });
  }

  function commit() {
    if (!csv) return;
    start(async () => {
      const r = await commitUnitImportAction(slug, csv);
      if (r?.ok) {
        setDone(r.data);
        reset();
      } else setError(r?.error.message ?? "Import failed. Nothing was saved.");
    });
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([UNIT_CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "dwellops-flats-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = preview?.rows.filter((r) => !problemsOnly || r.status !== "valid") ?? [];
  const s = preview?.summary;

  return (
    <div className="space-y-4">
      {done && (
        <Alert tone="success">
          {done.imported} flat{done.imported === 1 ? "" : "s"} imported.
          {done.skipped > 0 && ` ${done.skipped} row${done.skipped === 1 ? " was" : "s were"} skipped.`}
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {!preview && (
        <div className="space-y-3">
          <label
            htmlFor="csv-file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg px-4 py-8 text-center transition-colors hover:border-primary-ring hover:bg-primary-soft/40"
          >
            <Upload className="size-6 text-primary" aria-hidden />
            <span className="text-sm font-semibold">{pending ? "Checking file…" : "Choose a CSV file"}</span>
            <span className="text-xs text-muted">Columns: building_code, unit_number, floor, unit_type, area_sqft</span>
            <input
              ref={inputRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              disabled={pending}
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            <Download className="size-3.5" aria-hidden /> Download template
          </button>
        </div>
      )}

      {preview && s && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-subtle" aria-hidden />
            <span className="truncate font-semibold">{fileName}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="status">
            {(Object.keys(STATUS) as RowStatus[]).map((k) => (
              <div key={k} className={`rounded-lg px-3 py-2 ring-1 ring-inset ${STATUS[k].cls}`}>
                <p className="font-display text-xl font-bold tabular-nums">{s[k]}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide">{STATUS[k].label}</p>
              </div>
            ))}
          </div>
          {s.valid < preview.rows.length && (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} className="accent-[var(--color-primary)]" />
              Show only rows with problems
            </label>
          )}
          <div className="max-h-80 overflow-auto rounded-xl ring-1 ring-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-bg">
                <tr>
                  {["Row", "Status", "Building", "Flat", "Floor", "Problem"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 font-semibold uppercase tracking-wide text-subtle">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td className="px-3 py-2 tabular-nums text-subtle">{r.line}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                    </td>
                    <td className="px-3 py-2">{r.raw.building_code || "—"}</td>
                    <td className="px-3 py-2 font-semibold">{r.raw.unit_number || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{r.raw.floor || "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={commit} pending={pending} disabled={s.valid === 0}>
              {s.valid === 0 ? "Nothing to import" : `Import ${s.valid} flat${s.valid === 1 ? "" : "s"}`}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Choose another file
            </Button>
          </div>
          {s.valid > 0 && s.valid < preview.rows.length && <p className="text-xs text-muted">Rows with problems are skipped. Fix them in the file and import again later.</p>}
        </div>
      )}
    </div>
  );
}
