import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "info"; children: ReactNode }) {
  const { cls, Icon } = {
    danger: { cls: "bg-red-50 text-red-800 ring-red-200", Icon: AlertTriangle },
    success: { cls: "bg-green-50 text-green-800 ring-green-200", Icon: CheckCircle2 },
    info: { cls: "bg-primary-soft text-primary-strong ring-primary-ring/50", Icon: Info },
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`flex gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ring-1 ring-inset ${cls}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Small uppercase label above headings and in stat cards. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle ${className}`}>{children}</p>;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon?: LucideIcon; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-surface px-6 py-14 text-center">
      {Icon && (
        <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="font-semibold text-text">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1.5">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, children, actions, flush }: { title?: string; children: ReactNode; actions?: ReactNode; flush?: boolean }) {
  return (
    <section className="min-w-0 rounded-2xl bg-surface shadow-sm ring-1 ring-border">
      {title && (
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-bold text-text">{title}</h2>
          {actions}
        </header>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

type StatTone = "default" | "danger" | "warning" | "success";

/** Clickable metric. Tone applies only when value > 0 so zero never looks alarming. */
export function StatCard({
  label,
  value,
  href,
  tone = "default",
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  href: string;
  tone?: StatTone;
  icon: LucideIcon;
  hint?: string;
}) {
  const active = value > 0 && tone !== "default";
  const iconTone = {
    default: "bg-primary-soft text-primary",
    danger: active ? "bg-red-50 text-danger" : "bg-slate-100 text-subtle",
    warning: active ? "bg-amber-50 text-warning" : "bg-slate-100 text-subtle",
    success: active ? "bg-green-50 text-success" : "bg-slate-100 text-subtle",
  }[tone];
  const valueTone = active ? { default: "", danger: "text-danger", warning: "text-warning", success: "text-success" }[tone] : "text-text";
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl bg-surface p-4 shadow-sm ring-1 ring-border transition-all hover:-translate-y-px hover:shadow-md hover:ring-primary/30"
    >
      <span className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        <span className={`flex size-8 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="size-4" aria-hidden />
        </span>
      </span>
      <span className={`mt-3 text-3xl font-black tabular-nums tracking-tight ${valueTone}`}>{value}</span>
      {hint && <span className="mt-1 text-xs text-muted group-hover:text-primary">{hint}</span>}
    </Link>
  );
}

/** Shared table chrome so every operational table looks the same. */
export const table = {
  wrap: "overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-border",
  table: "w-full text-left text-sm",
  thead: "border-b border-border bg-bg",
  th: "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle",
  tbody: "divide-y divide-border",
  row: "transition-colors hover:bg-bg",
  td: "px-4 py-3",
};
