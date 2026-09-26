import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm shadow-primary/20 hover:bg-primary-hover active:bg-primary-hover",
  secondary: "bg-surface text-text ring-1 ring-inset ring-border hover:bg-bg hover:ring-slate-300",
  danger: "bg-danger text-white shadow-sm hover:bg-red-700",
  ghost: "text-muted hover:bg-slate-100 hover:text-text",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return `inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${extra}`;
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

export function Button({ variant = "primary", pending, disabled, className = "", children, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={buttonClass(variant, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}
