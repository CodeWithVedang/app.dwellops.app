import Link from "next/link";
import { notFound } from "next/navigation";
import { Bell, ChevronsUpDown, LogOut } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { hasPermission, loadSocietyContext } from "@/lib/auth/context";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db/client";
import { logoutAction } from "@/features/society/mutations";
import { ROLE_LABEL } from "@/features/society/constants";
import { noticeService } from "@/server/services/noticeService";
import { parcelService } from "@/server/services/parcelService";
import { BottomNav, SideNav, type NavItem } from "@/components/navigation/nav-links";
import { Logo, LogoMark } from "@/components/navigation/logo";
import { Avatar } from "@/components/ui/avatar";

export default async function SocietyLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const { slug } = await params;
  const user = await requireUserOrRedirect();
  const ctx = await loadSocietyContext(user, slug).catch((e: unknown) => {
    if (e instanceof AppError) notFound();
    throw e;
  });
  const gate = hasPermission(ctx, "parcel.view_all");
  const [unread, unreadNotices, parcelsWaiting] = await Promise.all([
    db.notification.count({ where: { userId: user.id, societyId: ctx.societyId, readAt: null } }),
    noticeService.unreadCount(ctx),
    parcelService.waitingCount(ctx),
  ]);
  const base = `/s/${slug}`;
  const manager = hasPermission(ctx, "complaint.view_all");
  const items: NavItem[] = [
    { href: base, label: "Home", icon: "home", exact: true, primary: true, group: "daily" },
    { href: `${base}/complaints`, label: manager ? "Complaints" : "My complaints", short: "Complaints", icon: "complaints", primary: true, group: "daily" },
    { href: `${base}/notices`, label: "Notice board", short: "Notices", icon: "notices", badge: unreadNotices, primary: true, group: "daily" },
    { href: `${base}/parcels`, label: gate ? "Parcel desk" : "My parcels", short: "Parcels", icon: "parcels", badge: parcelsWaiting, primary: true, group: "daily" },
    { href: `${base}/notifications`, label: "Notifications", short: "Alerts", icon: "notifications", badge: unread, primary: true, group: "daily" },
    ...(hasPermission(ctx, "building.manage") ? [{ href: `${base}/setup`, label: "Buildings & flats", icon: "setup" as const, group: "admin" as const }] : []),
    ...(hasPermission(ctx, "member.view") ? [{ href: `${base}/members`, label: "People", icon: "people" as const, group: "admin" as const }] : []),
    ...(hasPermission(ctx, "audit.view") ? [{ href: `${base}/audit`, label: "Audit log", icon: "audit" as const, group: "admin" as const }] : []),
    ...(hasPermission(ctx, "society.update") ? [{ href: `${base}/settings`, label: "Settings", icon: "settings" as const, group: "admin" as const }] : []),
  ];

  return (
    <div className="min-h-screen md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden flex-col bg-ink text-slate-300 md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-6 pb-5 pt-6">
          <Logo tone="light" href={base} />
        </div>
        <Link
          href="/societies"
          className="mx-3 mb-6 flex items-center gap-3 rounded-2xl bg-ink-2 px-3 py-2.5 ring-1 ring-inset ring-white/[0.06] transition-colors hover:ring-white/15"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent font-display text-sm font-bold text-ink">
            {ctx.societyName[0]?.toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">{ctx.societyName}</span>
            <span className="block truncate text-[11px] text-slate-400">{ctx.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-slate-500" aria-label="Switch society" />
        </Link>
        <SideNav items={items} />
        <div className="mt-auto border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar name={user.name} tone="dark" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-slate-100">{user.name}</span>
              <span className="block truncate text-[11px] text-slate-500">{user.email}</span>
            </span>
            <form action={logoutAction}>
              <button className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/10 hover:text-white" aria-label="Sign out">
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur md:hidden">
        <LogoMark className="size-8" />
        <Link href="/societies" className="min-w-0 flex-1">
          <span className="block truncate font-display text-[15px] font-bold leading-5">{ctx.societyName}</span>
          <span className="block truncate text-[11px] text-muted">{ctx.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</span>
        </Link>
        <Link href={`${base}/notifications`} className="relative rounded-xl p-2 text-muted hover:bg-bg" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="size-5" aria-hidden />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" aria-hidden />}
        </Link>
        <Link href="/societies" className="rounded-full" aria-label="Account and societies">
          <Avatar name={user.name} size="sm" />
        </Link>
      </header>

      <main className="pb-safe min-w-0 px-4 pt-5 sm:px-6 md:px-10 md:pb-12 md:pt-9">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      <BottomNav items={items} />
    </div>
  );
}
