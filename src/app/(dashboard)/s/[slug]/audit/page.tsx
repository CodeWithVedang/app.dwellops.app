import { ScrollText } from "lucide-react";
import Link from "next/link";

import { authorizePage, requirePageContext } from "@/lib/auth/page";
import { activityService } from "@/server/services/activityService";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { auditLabel } from "@/lib/audit/labels";

export const metadata = { title: "Audit log" };

function summarize(v: unknown): string {
  if (v == null) return "";
  const s = JSON.stringify(v);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

export default async function AuditPage({ params, searchParams }: PageProps<"/s/[slug]/audit">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "audit.view");
  const entityId = typeof sp.entityId === "string" ? sp.entityId : undefined;
  const page = typeof sp.page === "string" ? sp.page : "1";
  const result = await activityService.listAudit(ctx, { entityId, page });
  const base = `/s/${slug}/audit`;
  const q = (p: number) => `${base}?${new URLSearchParams({ ...(entityId ? { entityId } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every important change, who made it and when. Records can't be edited."
        actions={entityId && <Link href={base} className={buttonClass("secondary")}>Show all</Link>}
      />
      {result.items.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit entries" body="Changes will be recorded here as people use DwellOps." />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-bg">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">When</th>
                <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Who</th>
                <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Action</th>
                <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-muted tabular-nums">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-3">{a.actorName}</td>
                  <td className="px-4 py-3"><span className="block">{auditLabel(a.action)}</span><span className="font-mono text-[11px] text-subtle">{a.action}</span></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {a.before != null && <span className="block">before: {summarize(a.before)}</span>}
                    {a.after != null && <span className="block">after: {summarize(a.after)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex justify-end gap-2">
          {result.page > 1 && <Link className={buttonClass("secondary")} href={q(result.page - 1)}>Previous</Link>}
          {result.page < result.pageCount && <Link className={buttonClass("secondary")} href={q(result.page + 1)}>Next</Link>}
        </nav>
      )}
    </>
  );
}
