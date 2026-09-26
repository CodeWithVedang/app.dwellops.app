import { BellRing, ClipboardCheck, History, UserCheck } from "lucide-react";
import { Logo } from "@/components/navigation/logo";

const POINTS = [
  { icon: ClipboardCheck, title: "Every complaint has an owner", body: "Assigned, due time set, tracked until the resident confirms." },
  { icon: BellRing, title: "Residents stay in the loop", body: "Updates reach them automatically. No follow-up calls." },
  { icon: History, title: "Nothing gets lost", body: "Full history and an audit trail for every change." },
  { icon: UserCheck, title: "Built for committees", body: "Set up in minutes. No training needed." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_minmax(440px,1fr)]">
      <aside className="relative hidden overflow-hidden bg-ink p-12 text-slate-300 lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
          aria-hidden
        />
        <div className="relative">
          <Logo tone="light" />
        </div>
        <div className="relative my-auto max-w-lg py-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-ring ring-1 ring-inset ring-white/10">
            <span className="size-1.5 rounded-full bg-primary-ring" aria-hidden />
            Society operations
          </span>
          <h2 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-white">
            Know what&apos;s pending, who owns it, and what happens next.
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary-ring">
                  <Icon className="size-4" aria-hidden />
                </span>
                <p className="mt-3 text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{body}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Simple operations for better-managed societies.</p>
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="my-auto w-full max-w-sm self-center py-10">{children}</div>
      </main>
    </div>
  );
}
