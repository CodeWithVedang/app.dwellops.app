import { requirePageContext } from "@/lib/auth/page";
import { unitLabel } from "@/lib/units";
import { MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { hasPermission } from "@/lib/auth/context";
import { complaintService } from "@/server/services/complaintService";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { OverdueBadge, PriorityText, StatusBadge } from "@/features/complaints/components/status-badge";
import { COMPLAINT_CATEGORIES } from "@/features/complaints/constants";
import { isOverdue } from "@/features/complaints/domain";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Complaints" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "NEW", label: "New" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Awaiting confirmation" },
  { value: "CLOSED", label: "Closed" },
] as const;

export default async function ComplaintsPage({ params, searchParams }: PageProps<"/s/[slug]/complaints">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePageContext(slug);
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const status = str(sp.status);
  const q = str(sp.q);
  const result = await complaintService.list(ctx, { status: status || undefined, q: q || undefined, page: str(sp.page) ?? "1" });
  const base = `/s/${slug}/complaints`;
  const manager = hasPermission(ctx, "complaint.view_all");
  const canCreate = hasPermission(ctx, "complaint.create");
  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const categoryLabel = (c: string) => {
    const m = COMPLAINT_CATEGORIES.find((x) => x.value === c);
    return m ? `${m.emoji} ${m.label}` : c;
  };

  return (
    <>
      <PageHeader
        title={manager ? "Complaints" : "My complaints"}
        description={manager ? "Every issue raised in the society, with owner and due time." : "Issues you've raised and their progress."}
        actions={canCreate && <Link href={`${base}/new`} className={buttonClass("primary")}>Raise complaint</Link>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1">
          {FILTERS.map((f) => {
            const active = (status ?? "") === f.value;
            return (
              <Link
                key={f.value}
                href={href({ status: f.value || undefined, page: undefined })}
                aria-current={active ? "true" : undefined}
                className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? "bg-ink text-white shadow-sm" : "text-muted hover:bg-surface hover:text-text hover:shadow-sm"}`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
        <form className="flex gap-2" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <label htmlFor="q" className="sr-only">Search complaints</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search title, unit or #" className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm shadow-xs placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 sm:w-60" />
          <button className={buttonClass("secondary")}>Search</button>
        </form>
      </div>

      {result.items.length === 0 ? (
        <EmptyState icon={MessageSquareWarning}
          title={status || q ? "No complaints match" : "No complaints yet"}
          body={status || q ? "Try a different filter or search." : canCreate ? "When something needs fixing, raise it here and track it to closure." : "Nothing has been assigned to you."}
          action={!status && !q && canCreate ? <Link href={`${base}/new`} className={buttonClass("primary")}>Raise complaint</Link> : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-bg">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Complaint</th>
                  <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Unit</th>
                  <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Owner</th>
                  <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-bg">
                    <td className="px-4 py-2.5">
                      <Link href={`${base}/${c.id}`} className="font-medium text-text hover:text-primary">
                        <span className="mr-1.5 font-mono text-xs text-muted">#{c.number}</span>
                        {c.title}
                      </Link>
                      <span className="mt-0.5 flex gap-2 text-xs text-muted">
                        {categoryLabel(c.category)} · <PriorityText priority={c.priority} />
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{c.unit ? unitLabel(c.unit) : "Common"}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex flex-wrap gap-1">
                        <StatusBadge status={c.status} />
                        {isOverdue(c) && <OverdueBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{c.assignee?.user.name ?? <span className="text-muted">Unassigned</span>}</td>
                    <td className="px-4 py-2.5 text-muted tabular-nums">{c.status === "CLOSED" || c.status === "CANCELLED" ? "—" : relativeTime(c.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.pageCount > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                Page {result.page} of {result.pageCount} · {result.total} complaints
              </span>
              <span className="flex gap-2">
                {result.page > 1 && <Link className={buttonClass("secondary")} href={href({ page: String(result.page - 1) })}>Previous</Link>}
                {result.page < result.pageCount && <Link className={buttonClass("secondary")} href={href({ page: String(result.page + 1) })}>Next</Link>}
              </span>
            </nav>
          )}
        </>
      )}
    </>
  );
}
