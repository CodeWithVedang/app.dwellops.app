import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { Logo } from "@/components/navigation/logo";
import { requireUserOrRedirect } from "@/lib/auth/session";
import { societyService } from "@/server/services/societyService";
import { createSocietyAction, logoutAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { ROLE_LABEL } from "@/features/society/constants";

export const metadata = { title: "Your societies" };

export default async function SocietiesPage() {
  const user = await requireUserOrRedirect();
  const societies = await societyService.listForUser(user.id);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Logo href="/societies" />
        <form action={logoutAction}>
          <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-text">Sign out ({user.email})</button>
        </form>
      </header>

      {societies.length > 0 && (
        <section className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight">Your societies</h1>
          <ul className="mt-4 divide-y divide-border rounded-xl bg-surface shadow-sm ring-1 ring-border">
            {societies.map((s) => (
              <li key={s.slug}>
                <Link href={`/s/${s.slug}`} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-bg">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Building2 className="size-5" aria-hidden /></span>
                  <span>
                    <span className="block font-bold">{s.name}</span>
                    <span className="block text-xs text-muted">{s.city}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-muted">{s.members.map((m) => ROLE_LABEL[m.role]).join(", ")}<ArrowRight className="size-4 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border">
        <h2 className="text-lg font-bold tracking-tight">{societies.length ? "Set up another society" : "Set up your society"}</h2>
        <p className="mt-1 text-sm text-muted">You’ll be the society admin. You can add buildings, units and people next.</p>
        <ActionForm action={createSocietyAction} className="mt-5 grid gap-4 sm:grid-cols-2" resetOnSuccess={false}>
          <div className="sm:col-span-2">
            <TextField label="Society name" name="name" placeholder="Green Meadows CHS" required />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Address" name="address" required />
          </div>
          <TextField label="City" name="city" required />
          <TextField label="State" name="state" required />
          <TextField label="Office email (optional)" name="contactEmail" type="email" />
          <TextField label="Office phone (optional)" name="contactPhone" type="tel" />
          <div className="sm:col-span-2">
            <SubmitButton>Create society</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
