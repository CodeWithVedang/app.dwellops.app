"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/features/society/mutations";
import { Alert } from "@/components/ui/feedback";

type Action<T> = (state: FormState<T>, fd: FormData) => Promise<FormState<T>>;

const FieldErrorsCtx = createContext<{ errors: Record<string, string[]>; pending: boolean }>({ errors: {}, pending: false });

export const useFormErrors = () => useContext(FieldErrorsCtx);

interface Props<T> {
  action: Action<T>;
  children: ReactNode;
  className?: string;
  /** Message shown after success (for actions that don't redirect). */
  successMessage?: string | ((data: T) => ReactNode);
  resetOnSuccess?: boolean;
}

/** Form wired to a server action: pending state, form-level + field-level errors, success feedback. */
export function ActionForm<T>({ action, children, className, successMessage, resetOnSuccess = true }: Props<T>) {
  const [state, formAction, pending] = useActionState<FormState<T>, FormData>(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  const errors = state && !state.ok ? (state.error.fieldErrors ?? {}) : {};

  return (
    <FieldErrorsCtx.Provider value={{ errors, pending }}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {state && !state.ok && <Alert>{state.error.message}</Alert>}
        {state?.ok && successMessage && (
          <Alert tone="success">{typeof successMessage === "function" ? successMessage(state.data) : successMessage}</Alert>
        )}
        {children}
      </form>
    </FieldErrorsCtx.Provider>
  );
}
