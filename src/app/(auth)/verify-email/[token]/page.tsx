import { VerifyEmailForm } from "@/features/society/components/verify-email-form";

export const metadata = { title: "Confirm email" };

// Confirmation happens on a button press (POST), not on page load, so email scanners that
// pre-open links can't burn the token.
export default async function VerifyEmailPage({ params }: PageProps<"/verify-email/[token]">) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Confirm your email</h1>
      <p className="mt-1 text-sm text-muted">One tap and you&apos;re done.</p>
      <div className="mt-6">
        <VerifyEmailForm token={token} />
      </div>
    </>
  );
}
