"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SubmitButton, TextField } from "@/components/forms/fields";
import { adminOpAction } from "@/features/society/mutations";

interface Initial {
  name: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  slaCriticalHours: number;
  slaHighHours: number;
  slaNormalHours: number;
  slaLowHours: number;
}

const SLA = [
  { name: "slaCriticalHours", label: "Critical", hint: "Lift stuck, no water, safety" },
  { name: "slaHighHours", label: "High", hint: "Leak, no power in a flat" },
  { name: "slaNormalHours", label: "Normal", hint: "Most repairs" },
  { name: "slaLowHours", label: "Low", hint: "Cosmetic, can wait" },
] as const;

export function SettingsForm({ slug, initial }: { slug: string; initial: Initial }) {
  return (
    <ActionForm action={adminOpAction.bind(null, slug, "updateSociety")} className="space-y-6" resetOnSuccess={false} successMessage="Settings saved.">
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold">Society details</legend>
        <TextField label="Society name" name="name" defaultValue={initial.name} required />
        <TextField label="Address" name="address" defaultValue={initial.address} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="City" name="city" defaultValue={initial.city} required />
          <TextField label="State" name="state" defaultValue={initial.state} required />
          <TextField label="Office email" name="contactEmail" type="email" defaultValue={initial.contactEmail} />
          <TextField label="Office phone" name="contactPhone" type="tel" defaultValue={initial.contactPhone} />
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="text-sm font-bold">Complaint response times</legend>
        <p className="text-xs text-muted">
          How many hours the team has to fix a complaint, by urgency. After this time it shows as overdue and the owner is alerted. Changes apply to new complaints.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SLA.map((s) => (
            <TextField key={s.name} label={`${s.label} (hours)`} name={s.name} type="number" min={1} max={720} defaultValue={initial[s.name]} hint={s.hint} required />
          ))}
        </div>
      </fieldset>

      <SubmitButton>Save settings</SubmitButton>
    </ActionForm>
  );
}
