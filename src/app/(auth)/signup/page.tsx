import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { signUpAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/societies");
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">You’ll set up your society next.</p>
      <ActionForm action={signUpAction} className="mt-6 space-y-4" resetOnSuccess={false}>
        <TextField label="Full name" name="name" autoComplete="name" required />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." required />
        <SubmitButton className="w-full">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
