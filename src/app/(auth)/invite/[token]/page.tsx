import Link from "next/link";
import { authService } from "@/server/services/authService";
import { acceptInviteAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { ROLE_LABEL } from "@/features/society/constants";

export const metadata = { title: "Accept invite" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = await authService.findInvite(token);
  if (!invite) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight">This invite can’t be used</h1>
        <p className="mt-2 text-sm text-muted">The link is invalid, expired, or already used. Ask your society office to send a new invite.</p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{invite.society.name}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">Hi {invite.name}, join your society</h1>
      <p className="mt-1 text-sm text-muted">
        You’re invited as <strong className="text-text">{ROLE_LABEL[invite.role]}</strong>
        {invite.unit ? ` for unit ${invite.unit.unitNumber}` : ""}.
      </p>
      <ActionForm action={acceptInviteAction} className="mt-6 space-y-4" resetOnSuccess={false}>
        <input type="hidden" name="token" value={token} />
        <div className="rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-inset ring-border">
          <span className="text-muted">Email</span> <span className="font-medium">{invite.email}</span>
        </div>
        <TextField
          label={invite.hasAccount ? "Your DwellOps password" : "Choose a password"}
          name="password"
          type="password"
          autoComplete={invite.hasAccount ? "current-password" : "new-password"}
          hint={invite.hasAccount ? "You already have an account. Confirm it's you." : "At least 10 characters."}
          required
        />
        <SubmitButton className="w-full">Join {invite.society.name}</SubmitButton>
      </ActionForm>
    </>
  );
}
