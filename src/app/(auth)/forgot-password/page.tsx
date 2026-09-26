import Link from "next/link";
import { forgotPasswordAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we&apos;ll send a link to choose a new one.</p>
      <ActionForm
        action={forgotPasswordAction}
        className="mt-6 space-y-4"
        successMessage="If an account exists for that email, a reset link is on its way. It works for 1 hour. Check spam too."
      >
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
