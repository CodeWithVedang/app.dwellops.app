"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  Home,
  Megaphone,
  MessageSquareWarning,
  Package,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  home: Home,
  complaints: MessageSquareWarning,
  notices: Megaphone,
  parcels: Package,
  notifications: Bell,
  setup: Building2,
  people: Users,
  audit: ScrollText,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  /** Short label for the phone tab bar. */
  short?: string;
  icon: NavIcon;
  exact?: boolean;
  badge?: number;
  /** Show in the phone bottom bar. */
  primary?: boolean;
  group: "daily" | "admin";
}

function useActive() {
  const path = usePathname();
  return (i: NavItem) => (i.exact ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
}

function Badge({ n, className = "" }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={`min-w-[18px] rounded-full bg-accent px-1.5 py-px text-center text-[10px] font-bold leading-4 text-ink ${className}`}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> new</span>
    </span>
  );
}

export function SideNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  const groups: { key: NavItem["group"]; label: string }[] = [
    { key: "daily", label: "Everyday" },
    { key: "admin", label: "Manage" },
  ];
  return (
    <nav aria-label="Main" className="space-y-5 px-3">
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key}>
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{g.label}</p>
            <ul className="space-y-0.5">
              {list.map((i) => {
                const active = isActive(i);
                const Icon = ICONS[i.icon];
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors ${
                        active ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      }`}
                    >
                      {active && <span className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-accent" aria-hidden />}
                      <Icon className={`size-[18px] shrink-0 ${active ? "text-accent" : "text-slate-500 group-hover:text-slate-300"}`} aria-hidden />
                      <span className="flex-1">{i.label}</span>
                      <Badge n={i.badge} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Phone tab bar: the 4–5 things people do daily, thumb-reachable. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const isActive = useActive();
  const primary = items.filter((i) => i.primary).slice(0, 5);
  return (
    <nav
      aria-label="Quick"
      className="bottom-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
        {primary.map((i) => {
          const active = isActive(i);
          const Icon = ICONS[i.icon];
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[10.5px] font-semibold ${active ? "text-primary" : "text-subtle"}`}
              >
                {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary" aria-hidden />}
                <span className="relative">
                  <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                  <Badge n={i.badge} className="absolute -right-2.5 -top-1.5" />
                </span>
                {i.short ?? i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
