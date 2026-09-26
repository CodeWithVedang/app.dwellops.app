import Link from "next/link";
import { accountService } from "@/server/services/accountService";
import { resetPasswordAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const valid = token.length >= 20 && token.length <= 200 && (await accountService.isResetTokenValid(token));
  if (!valid) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">This link has expired</h1>
        <p className="mt-2 text-sm text-muted">Reset links work for 1 hour and only once. Ask for a new one.</p>
        <Link href="/forgot-password" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
          Send a new link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">You&apos;ll be signed out on all other devices.</p>
      <ActionForm action={resetPasswordAction} className="mt-6 space-y-4" resetOnSuccess={false}>
        <input type="hidden" name="token" value={token} />
        <TextField label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." required />
        <TextField label="Type it again" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Save password</SubmitButton>
      </ActionForm>
    </>
  );
}
