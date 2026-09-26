"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useFormErrors } from "./action-form";

interface Base {
  label: string;
  name: string;
  hint?: string;
}

export function TextField({ label, name, hint, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const { errors } = useFormErrors();
  return (
    <Field label={label} name={name} hint={hint} error={errors[name]}>
      {(a) => <Input name={name} {...a} {...rest} />}
    </Field>
  );
}

export function TextAreaField({ label, name, hint, ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { errors } = useFormErrors();
  return (
    <Field label={label} name={name} hint={hint} error={errors[name]}>
      {(a) => <Textarea name={name} {...a} {...rest} />}
    </Field>
  );
}

export function SelectField({ label, name, hint, children, ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const { errors } = useFormErrors();
  return (
    <Field label={label} name={name} hint={hint} error={errors[name]}>
      {(a) => (
        <Select name={name} {...a} {...rest}>
          {children}
        </Select>
      )}
    </Field>
  );
}

export function SubmitButton({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const { pending } = useFormErrors();
  return (
    <Button type="submit" variant={variant} pending={pending} className={className}>
      {children}
    </Button>
  );
}
