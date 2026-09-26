import { requirePageContext } from "@/lib/auth/page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CheckCheck, Eye, Users } from "lucide-react";
import { hasPermission } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";
import { noticeService } from "@/server/services/noticeService";
import { Alert, Eyebrow, Panel } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { AUDIENCE_LABEL, CATEGORY_META, noticeState } from "@/features/notices/domain";
import { noticeOpAction } from "@/features/notices/mutations";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notice" };

export default async function NoticePage({ params, searchParams }: PageProps<"/s/[slug]/notices/[id]">) {
  const { slug, id } = await params;
  const { saved } = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const ctx = await requirePageContext(slug);
  const n = await noticeService.get(ctx, id).catch((e: unknown) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const manages = hasPermission(ctx, "notice.manage");
  const stats = hasPermission(ctx, "notice.view_stats") && n.status !== "DRAFT" ? await noticeService.stats(ctx, n.id) : null;
  const state = noticeState(n);
  const meta = CATEGORY_META[n.category];
  const op = (name: "publish" | "archive" | "acknowledge") => noticeOpAction.bind(null, slug, name);
  const hidden = <input type="hidden" name="noticeId" value={n.id} />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <article className="min-w-0">
        <Link href={`/s/${slug}/notices`} className="text-sm font-medium text-muted hover:text-text">
          ← Notice board
        </Link>
        {saved === "1" && (
          <div className="mt-4">
            <Alert tone="success">{n.status === "DRAFT" ? "Draft saved. Publish it when you're ready." : "Published. Everyone in the audience has been notified."}</Alert>
          </div>
        )}
        <div
          className={`mt-4 overflow-hidden rounded-2xl bg-surface ring-1 ${n.priority === "URGENT" ? "ring-danger/40" : "ring-border"}`}
        >
          {n.priority === "URGENT" && <div className="bg-danger px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-white">Urgent notice</div>}
          <div className="p-5 sm:p-7">
            <Eyebrow>
              {meta.emoji} {meta.label} · For {n.audience === "BUILDING" && n.building ? n.building.name : AUDIENCE_LABEL[n.audience].toLowerCase()}
            </Eyebrow>
            <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-[28px]">{n.title}</h1>
            <p className="mt-2 text-xs text-subtle">
              {n.authorName} · {n.publishedAt ? formatDateTime(n.publishedAt) : "Not published"}
              {n.expiresAt && ` · Until ${formatDateTime(n.expiresAt)}`}
              {state === "EXPIRED" && " · Expired"}
              {state === "ARCHIVED" && " · Archived"}
            </p>
            <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-text">{n.body}</div>

            {n.requiresAck && n.status === "PUBLISHED" && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary-soft px-4 py-3">
                {n.myRead?.acknowledgedAt ? (
                  <p className="flex items-center gap-2 text-sm font-semibold text-primary-strong">
                    <CheckCheck className="size-4" aria-hidden /> You confirmed on {formatDateTime(n.myRead.acknowledgedAt)}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-primary-strong">The office asked everyone to confirm they&apos;ve seen this.</p>
                    <ActionForm action={op("acknowledge")}>
                      {hidden}
                      <SubmitButton>Got it</SubmitButton>
                    </ActionForm>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {manages && n.status !== "ARCHIVED" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {n.status === "DRAFT" && (
              <ActionForm action={op("publish")}>
                {hidden}
                <SubmitButton>Publish &amp; notify</SubmitButton>
              </ActionForm>
            )}
            <ActionForm action={op("archive")}>
              {hidden}
              <SubmitButton variant="secondary">{n.status === "DRAFT" ? "Discard draft" : "Archive notice"}</SubmitButton>
            </ActionForm>
          </div>
        )}
      </article>

      {stats && (
        <aside className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Reached", value: stats.total, icon: Users },
              { label: "Read", value: stats.read, icon: Eye },
              ...(n.requiresAck ? [{ label: "Confirmed", value: stats.acknowledged, icon: CheckCheck }] : []),
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-surface p-3 ring-1 ring-border">
                <s.icon className="size-4 text-subtle" aria-hidden />
                <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{s.label}</p>
              </div>
            ))}
          </div>
          <Panel title={n.requiresAck ? "Who hasn't confirmed" : "Who has read it"} flush>
            {stats.rows.length === 0 ? (
              <p className="p-5 text-sm text-muted">Nobody is in this audience yet.</p>
            ) : (
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {stats.rows.map((r) => {
                  const done = n.requiresAck ? !!r.read?.acknowledgedAt : !!r.read;
                  return (
                    <li key={r.userId} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <Avatar name={r.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{r.name}</span>
                        {r.units.length > 0 && <span className="block text-xs text-subtle">{r.units.join(", ")}</span>}
                      </span>
                      <span className={`text-xs font-semibold ${done ? "text-success" : "text-subtle"}`}>{done ? (n.requiresAck ? "Confirmed" : "Read") : "Not yet"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      )}
    </div>
  );
}
