import type { ComplaintStatus, Priority } from "@/generated/prisma/enums";
import { PRIORITIES, STATUS_LABEL } from "../constants";

const STATUS_TONE: Record<ComplaintStatus, string> = {
  NEW: "bg-primary-soft text-primary-strong ring-primary-ring/50",
  ACKNOWLEDGED: "bg-primary-soft text-primary-strong ring-primary-ring/50",
  ASSIGNED: "bg-sky-50 text-sky-700 ring-sky-200",
  IN_PROGRESS: "bg-sky-50 text-sky-700 ring-sky-200",
  WAITING: "bg-amber-50 text-amber-800 ring-amber-200",
  RESOLVED: "bg-green-50 text-green-700 ring-green-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  REOPENED: "bg-red-50 text-red-700 ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 ring-slate-200",
};

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset";

export function StatusBadge({ status }: { status: ComplaintStatus }) {
  return (
    <span className={`${pill} ${STATUS_TONE[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OverdueBadge() {
  return <span className={`${pill} bg-danger text-white ring-danger`}>Overdue</span>;
}

export function PriorityText({ priority }: { priority: Priority }) {
  const label = PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
  const tone =
    priority === "CRITICAL" ? "text-danger font-bold" : priority === "HIGH" ? "text-warning font-semibold" : "text-subtle font-medium";
  return <span className={`text-xs ${tone}`}>{label}</span>;
}
