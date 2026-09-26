import { requirePageContext } from "@/lib/auth/page";
import Link from "next/link";
import { Megaphone, Pin, Plus } from "lucide-react";
import { hasPermission } from "@/lib/auth/context";
import { noticeService } from "@/server/services/noticeService";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { AUDIENCE_LABEL, CATEGORY_META } from "@/features/notices/domain";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Notice board" };

const TABS = [
  { key: "current", label: "Current" },
  { key: "drafts", label: "Drafts", manage: true },
  { key: "past", label: "Past" },
] as const;

export default async function NoticesPage({ params, searchParams }: PageProps<"/s/[slug]/notices">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePageContext(slug);
  const manages = hasPermission(ctx, "notice.manage");
  const requested = typeof sp.view === "string" ? sp.view : "current";
  const view = requested === "drafts" && !manages ? "current" : requested;
  const notices = await noticeService.list(ctx, { view });
  const base = `/s/${slug}/notices`;

  return (
    <>
      <PageHeader
        eyebrow="Notice board"
        title="What's happening in the society"
        description="Official notices from the office — no more scrolling WhatsApp groups."
        actions={
          manages && (
            <Link href={`${base}/new`} className={buttonClass("primary")}>
              <Plus className="size-4" aria-hidden /> Post notice
            </Link>
          )
        }
      />

      <nav aria-label="Notice views" className="mb-5 inline-flex rounded-xl bg-surface p-1 ring-1 ring-border">
        {TABS.filter((t) => !("manage" in t) || manages).map((t) => (
          <Link
            key={t.key}
            href={t.key === "current" ? base : `${base}?view=${t.key}`}
            aria-current={view === t.key ? "page" : undefined}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              view === t.key ? "bg-ink text-white" : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {notices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={view === "drafts" ? "No drafts" : view === "past" ? "Nothing archived yet" : "No notices right now"}
          body={manages ? "Post water cuts, meetings, events and rules here. Residents get notified instantly." : "When the office posts something for you, it will show up here."}
          action={manages && view === "current" ? <Link href={`${base}/new`} className={buttonClass("primary")}>Post the first notice</Link> : undefined}
        />
      ) : (
        <ul className="grid gap-3">
          {notices.map((n) => {
            const meta = CATEGORY_META[n.category];
            const unread = n.status === "PUBLISHED" && !n.myRead;
            const needsAck = n.requiresAck && n.myRead && !n.myRead.acknowledgedAt;
            return (
              <li key={n.id}>
                <Link
                  href={`${base}/${n.id}`}
                  className={`group flex gap-4 rounded-2xl bg-surface p-4 ring-1 transition-all hover:-translate-y-px hover:shadow-md sm:p-5 ${
                    n.priority === "URGENT" ? "ring-danger/40" : "ring-border hover:ring-primary/30"
                  }`}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-bg text-xl" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                      {n.pinned && (
                        <span className="inline-flex items-center gap-1 text-accent">
                          <Pin className="size-3" aria-hidden /> Pinned ·
                        </span>
                      )}
                      {meta.label}
                      {n.priority !== "NORMAL" && (
                        <span className={`rounded-full px-1.5 py-px text-[10px] ${n.priority === "URGENT" ? "bg-danger text-white" : "bg-accent-soft text-warning"}`}>
                          {n.priority === "URGENT" ? "Urgent" : "Important"}
                        </span>
                      )}
                      {n.status === "DRAFT" && <span className="rounded-full bg-slate-100 px-1.5 py-px text-[10px] text-muted">Draft</span>}
                    </span>
                    <span className={`mt-1 block font-display text-[17px] leading-snug ${unread ? "font-bold" : "font-semibold"} text-text group-hover:text-primary`}>
                      {unread && <span className="mr-2 inline-block size-2 -translate-y-0.5 rounded-full bg-accent" aria-label="Unread" />}
                      {n.title}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-sm text-muted">{n.body}</span>
                    <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                      <span>{n.publishedAt ? relativeTime(n.publishedAt) : `Saved ${relativeTime(n.createdAt)}`}</span>
                      <span>For {n.audience === "BUILDING" && n.building ? n.building.name : AUDIENCE_LABEL[n.audience].toLowerCase()}</span>
                      {manages && n.status === "PUBLISHED" && <span>{n._count.reads} read</span>}
                      {needsAck && <span className="font-semibold text-warning">Please confirm you&apos;ve seen this</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
