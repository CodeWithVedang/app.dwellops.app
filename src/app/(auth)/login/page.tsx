import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { loginAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { Alert } from "@/components/ui/feedback";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { signedOut } = await searchParams;
  if (await getSessionUser()) redirect("/societies");
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back to DwellOps.</p>
      {signedOut === "all" && (
        <div className="mt-4">
          <Alert tone="success">You were signed out on all devices.</Alert>
        </div>
      )}
      <ActionForm action={loginAction} className="mt-6 space-y-4" resetOnSuccess={false}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">
        Setting up a new society?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted">Residents and staff: use the invite link from your society office.</p>
    </>
  );
}
