import { requirePageContext } from "@/lib/auth/page";
import { unitLabel } from "@/lib/units";
import Link from "next/link";
import type { ReactNode } from "react";
import { AlarmClock, ArrowRight, Check, ChevronRight, CircleDot, Inbox, Megaphone, MessageSquarePlus, Package, ThumbsUp } from "lucide-react";
import { hasPermission } from "@/lib/auth/context";
import { complaintService } from "@/server/services/complaintService";
import { societyService } from "@/server/services/societyService";
import { activityService } from "@/server/services/activityService";
import { noticeService } from "@/server/services/noticeService";
import { parcelService } from "@/server/services/parcelService";
import { Eyebrow, Panel, StatCard } from "@/components/ui/feedback";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/features/complaints/components/status-badge";
import { CATEGORY_META } from "@/features/notices/domain";
import { auditLabel } from "@/lib/audit/labels";
import { formatDateTime, relativeTime } from "@/lib/format";

export const metadata = { title: "Home" };

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function TodoItem({ href, icon, tone, title, meta }: { href: string; icon: ReactNode; tone: string; title: ReactNode; meta: ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-bg sm:px-5">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-xs text-muted">{meta}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
      </Link>
    </li>
  );
}

function QuickAction({ href, icon, label, hint }: { href: string; icon: ReactNode; label: string; hint: string }) {
  return (
    <Link href={href} className="group flex flex-col gap-2.5 rounded-2xl bg-surface p-3 ring-1 sm:gap-3 sm:p-4 ring-border transition-all hover:-translate-y-px hover:shadow-md hover:ring-primary/30">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
      <span>
        <span className="block font-display text-[13px] font-bold leading-tight sm:text-[15px]">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted sm:text-xs">{hint}</span>
      </span>
    </Link>
  );
}

export default async function HomePage({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  const base = `/s/${slug}`;
  const manager = hasPermission(ctx, "complaint.view_all");
  const gate = hasPermission(ctx, "parcel.view_all");
  const canCreate = hasPermission(ctx, "complaint.create");
  const firstName = ctx.user.name.split(" ")[0];

  const [summary, notices, parcels] = await Promise.all([
    complaintService.summary(ctx),
    noticeService.list(ctx, { view: "current" }),
    parcelService.list(ctx, { view: "waiting" }),
  ]);
  const unreadNotices = notices.filter((n) => !n.myRead);
  const ackNeeded = notices.filter((n) => n.requiresAck && !n.myRead?.acknowledgedAt);

  const header = (
    <div className="mb-6">
      <Eyebrow>{ctx.societyName}</Eyebrow>
      <h1 className="mt-1 text-[26px] font-bold leading-tight sm:text-3xl">
        {greeting()}, {firstName}
      </h1>
    </div>
  );

  // ---------------- Residents, tenants, staff ----------------
  if (!manager) {
    const [toConfirm, active] = await Promise.all([
      canCreate ? complaintService.list(ctx, { status: "RESOLVED" }) : Promise.resolve({ items: [] }),
      complaintService.list(ctx, { status: "OPEN" }),
    ]);
    const todo = toConfirm.items.length + (gate ? 0 : parcels.length) + ackNeeded.length;
    return (
      <>
        {header}
        {todo > 0 && (
          <section className="mb-6">
            <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
              Needs you <span className="rounded-full bg-accent px-1.5 text-[11px] text-ink">{todo}</span>
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
              {!gate &&
                parcels.map((p) => (
                  <TodoItem
                    key={p.id}
                    href={`${base}/parcels`}
                    tone="bg-accent-soft text-warning"
                    icon={<Package className="size-5" aria-hidden />}
                    title={`${p.courier} parcel at the gate`}
                    meta={
                      <>
                        Pickup code <span className="font-mono font-bold text-text">{p.pickupCode}</span> · arrived {relativeTime(p.receivedAt)}
                      </>
                    }
                  />
                ))}
              {toConfirm.items.map((c) => (
                <TodoItem
                  key={c.id}
                  href={`${base}/complaints/${c.id}`}
                  tone="bg-green-50 text-success"
                  icon={<ThumbsUp className="size-5" aria-hidden />}
                  title={`Is "${c.title}" fixed?`}
                  meta="Confirm or reopen the complaint"
                />
              ))}
              {ackNeeded.map((n) => (
                <TodoItem
                  key={n.id}
                  href={`${base}/notices/${n.id}`}
                  tone="bg-primary-soft text-primary"
                  icon={<Megaphone className="size-5" aria-hidden />}
                  title={n.title}
                  meta="Office asked you to confirm you've seen this"
                />
              ))}
            </ul>
          </section>
        )}

        {canCreate && (
          <div className="mb-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            <QuickAction href={`${base}/complaints/new`} icon={<MessageSquarePlus className="size-5" aria-hidden />} label="Report a problem" hint="Lift, water, leaks…" />
            <QuickAction href={`${base}/notices`} icon={<Megaphone className="size-5" aria-hidden />} label="Notice board" hint={unreadNotices.length ? `${unreadNotices.length} new` : "All caught up"} />
            <QuickAction href={`${base}/parcels`} icon={<Package className="size-5" aria-hidden />} label="My parcels" hint={parcels.length ? `${parcels.length} waiting` : "Nothing waiting"} />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title={canCreate ? "Your open complaints" : "Assigned to you"}
            flush
            actions={
              <Link href={`${base}/complaints`} className="text-xs font-semibold text-primary hover:underline">
                See all
              </Link>
            }
          >
            {active.items.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">{canCreate ? "Nothing open. Everything's working 🎉" : "No work assigned right now."}</p>
            ) : (
              <ul className="divide-y divide-border">
                {active.items.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/complaints/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-bg">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.title}</span>
                        <span className="block text-xs text-muted">
                          #{c.number} · {c.assignee ? `with ${c.assignee.user.name}` : "waiting for the office"}
                        </span>
                      </span>
                      <StatusBadge status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <LatestNotices base={base} notices={notices} />
        </div>
      </>
    );
  }

  // ---------------- Managers, admins, committee ----------------
  const [setup, recent, overdueList, newList] = await Promise.all([
    societyService.setupProgress(ctx),
    hasPermission(ctx, "audit.view") ? activityService.recent(ctx, 6) : Promise.resolve([]),
    complaintService.list(ctx, { status: "OVERDUE" }),
    complaintService.list(ctx, { status: "NEW" }),
  ]);
  const steps = [
    { done: setup.buildings > 0, label: "Add a building", href: `${base}/setup` },
    { done: setup.units > 0, label: "Add flats", href: `${base}/setup` },
    { done: setup.members > 1, label: "Invite residents & staff", href: `${base}/members` },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const attention = [
    ...overdueList.items.slice(0, 4).map((c) => ({ c, kind: "overdue" as const })),
    ...newList.items.slice(0, 4).map((c) => ({ c, kind: "new" as const })),
  ];

  return (
    <>
      {header}

      {doneCount < steps.length && (
        <section className="mb-6 overflow-hidden rounded-2xl bg-ink text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
                Setup · {doneCount} of {steps.length}
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">Get {ctx.societyName} ready for residents</h2>
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Setup progress">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
          </div>
          <ol className="grid border-t border-white/[0.06] sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.label} className="border-white/[0.06] sm:border-l sm:first:border-l-0">
                <Link href={s.href} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-white/5">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.done ? "bg-success text-white" : "bg-white/10 text-white ring-1 ring-inset ring-white/15"}`}>
                    {s.done ? <Check className="size-3.5" aria-label="Done" /> : i + 1}
                  </span>
                  <span className={s.done ? "text-slate-500 line-through" : "font-semibold text-white"}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open complaints" value={summary.open} href={`${base}/complaints?status=OPEN`} icon={CircleDot} hint="View all" />
        <StatCard label="Overdue" value={summary.overdue} href={`${base}/complaints?status=OVERDUE`} tone="danger" icon={AlarmClock} hint="Past due time" />
        <StatCard label="Need an owner" value={summary.counts.NEW ?? 0} href={`${base}/complaints?status=NEW`} tone="warning" icon={Inbox} hint="Assign someone" />
        <StatCard label="Parcels at gate" value={parcels.length} href={`${base}/parcels`} tone="warning" icon={Package} hint="Waiting pickup" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Needs attention"
          flush
          actions={
            <Link href={`${base}/complaints?status=OPEN`} className="text-xs font-semibold text-primary hover:underline">
              All open
            </Link>
          }
        >
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted">
              <span className="flex size-9 items-center justify-center rounded-xl bg-green-50 text-success">
                <Check className="size-5" aria-hidden />
              </span>
              Nothing overdue or unassigned. Nice work.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map(({ c, kind }) => (
                <TodoItem
                  key={`${kind}-${c.id}`}
                  href={`${base}/complaints/${c.id}`}
                  tone={kind === "overdue" ? "bg-red-50 text-danger" : "bg-accent-soft text-warning"}
                  icon={kind === "overdue" ? <AlarmClock className="size-5" aria-hidden /> : <Inbox className="size-5" aria-hidden />}
                  title={
                    <>
                      <span className="font-mono text-xs text-subtle">#{c.number}</span> {c.title}
                    </>
                  }
                  meta={`${c.unit ? unitLabel(c.unit) : "Common area"} · ${
                    kind === "overdue" ? `due ${relativeTime(c.dueAt)}${c.assignee ? ` · ${c.assignee.user.name}` : ""}` : `raised ${relativeTime(c.createdAt)} · no owner yet`
                  }`}
                />
              ))}
            </ul>
          )}
        </Panel>
        <LatestNotices base={base} notices={notices} manage />
      </div>

      {recent.length > 0 && (
        <div className="mt-6">
          <Panel
            title="Recent activity"
            flush
            actions={
              <Link href={`${base}/audit`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Audit log <ArrowRight className="size-3" aria-hidden />
              </Link>
            }
          >
            <ul className="divide-y divide-border text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={a.actorName} size="sm" />
                    <span className="truncate">
                      <span className="font-semibold">{a.actorName}</span> <span className="text-muted">{auditLabel(a.action)}</span>
                    </span>
                  </span>
                  <time className="shrink-0 text-xs text-subtle">{formatDateTime(a.createdAt)}</time>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}

function LatestNotices({
  base,
  notices,
  manage,
}: {
  base: string;
  notices: { id: string; title: string; category: keyof typeof CATEGORY_META; publishedAt: Date | null; myRead: unknown; pinned: boolean }[];
  manage?: boolean;
}) {
  return (
    <Panel
      title="Notice board"
      flush
      actions={
        <Link href={manage ? `${base}/notices/new` : `${base}/notices`} className="text-xs font-semibold text-primary hover:underline">
          {manage ? "Post notice" : "See all"}
        </Link>
      }
    >
      {notices.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">{manage ? "No live notices. Post water cuts, meetings and events here." : "No notices right now."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {notices.slice(0, 5).map((n) => (
            <li key={n.id}>
              <Link href={`${base}/notices/${n.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-bg">
                <span className="text-lg" aria-hidden>
                  {CATEGORY_META[n.category].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${n.myRead ? "font-medium" : "font-bold"}`}>{n.title}</span>
                  <span className="block text-xs text-subtle">
                    {n.pinned ? "Pinned · " : ""}
                    {n.publishedAt ? relativeTime(n.publishedAt) : ""}
                  </span>
                </span>
                {!n.myRead && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
