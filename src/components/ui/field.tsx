import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "block w-full rounded-lg border border-border bg-surface px-3 text-sm text-text shadow-xs placeholder:text-subtle hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15 disabled:bg-bg";

interface FieldProps {
  label: string;
  name: string;
  error?: string[];
  hint?: string;
  children: (a11y: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

export function Field({ label, name, error, hint, children }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = [error?.length ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-text">
        {label}
      </label>
      {children({ id, "aria-invalid": error?.length ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error?.length && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error?.length ? (
        <p id={`${id}-err`} className="text-xs font-medium text-danger">
          {error[0]}
        </p>
      ) : null}
    </div>
  );
}

export const Input = ({ className = "", ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={`${control} h-9 ${className}`} {...p} />;
export const Select = ({ className = "", ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={`${control} h-9 ${className}`} {...p} />;
export const Textarea = ({ className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${control} min-h-24 py-2 ${className}`} {...p} />
);
