import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-primary-strong shadow-sm ${className}`}>
      <svg viewBox="0 0 32 32" className="size-[70%]" fill="none" aria-hidden>
        <path d="M4 15.5 16 5l12 10.5" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 13.5V26h16V13.5" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="13" y="16" width="6" height="6" rx="1.4" className="fill-accent" />
      </svg>
    </span>
  );
}

/** Wordmark. `tone` picks text color for dark or light backgrounds. */
export function Logo({ tone = "dark", href = "/" }: { tone?: "dark" | "light"; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5" aria-label="DwellOps home">
      <LogoMark />
      <span className={`font-display text-[19px] font-bold tracking-tight ${tone === "light" ? "text-white" : "text-text"}`}>
        dwell<span className="text-accent">ops</span>
      </span>
    </Link>
  );
}
