"use client";

import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton } from "@/components/forms/fields";
import { resendVerificationAction, verifyEmailAction } from "@/features/society/mutations";
import { buttonClass } from "@/components/ui/button";

export function VerifyEmailForm({ token }: { token: string }) {
  return (
    <ActionForm<{ verified: boolean }>
      action={verifyEmailAction}
      resetOnSuccess={false}
      className="space-y-4"
      successMessage={() => (
        <span>
          Email confirmed. <Link href="/societies" className={`${buttonClass("primary")} mt-3 flex w-full`}>Continue</Link>
        </span>
      )}
    >
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full">Confirm my email</SubmitButton>
    </ActionForm>
  );
}

/** Banner for signed-in users whose email isn't confirmed yet. */
export function VerifyEmailBanner({ email }: { email: string }) {
  return (
    <ActionForm
      action={resendVerificationAction}
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm ring-1 ring-accent/40"
      successMessage={`Sent. Check ${email} (and spam).`}
    >
      <span className="min-w-0 flex-1">
        <span className="font-semibold">Confirm your email</span>
        <span className="block text-xs text-muted">We sent a link to {email}. You need it to reset your password later.</span>
      </span>
      <SubmitButton variant="secondary">Resend link</SubmitButton>
    </ActionForm>
  );
}
