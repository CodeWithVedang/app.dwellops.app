"use client";

import { useState } from "react";
import { PackageCheck, Undo2 } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { logParcelAction, parcelOpAction } from "@/features/parcels/mutations";
import { COURIERS } from "@/features/parcels/schemas";

interface UnitOption {
  id: string;
  label: string;
  building: string;
  hasResidents: boolean;
}

export function LogParcelForm({ slug, units }: { slug: string; units: UnitOption[] }) {
  const [courier, setCourier] = useState("");
  const buildings = [...new Set(units.map((u) => u.building))];
  return (
    <ActionForm<{ number: number; notified: number; unit: string }>
      action={logParcelAction.bind(null, slug)}
      className="space-y-4"
      successMessage={(d) =>
        d.notified > 0
          ? `Parcel #${d.number} logged for ${d.unit}. ${d.notified} resident${d.notified === 1 ? "" : "s"} notified with a pickup code.`
          : `Parcel #${d.number} logged for ${d.unit}. Nobody is registered in this flat yet — call them.`
      }
    >
      <SelectField label="Flat" name="unitId" defaultValue="" required>
        <option value="" disabled>
          Choose flat
        </option>
        {buildings.map((b) => (
          <optgroup key={b} label={`Building ${b}`}>
            {units
              .filter((u) => u.building === b)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                  {u.hasResidents ? "" : " (no residents yet)"}
                </option>
              ))}
          </optgroup>
        ))}
      </SelectField>
      <div>
        <p className="text-[13px] font-semibold">Courier</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COURIERS.filter((c) => c !== "Other").map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCourier(c)}
              aria-pressed={courier === c}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors ${
                courier === c ? "bg-primary text-white ring-primary" : "bg-bg text-text ring-border hover:ring-primary-ring"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <TextField label="Courier name" name="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Or type another" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Kept at (optional)" name="storageLocation" placeholder="Rack 2, security cabin" />
        <TextField label="Tracking no. (optional)" name="trackingNumber" />
      </div>
      <TextField label="Note (optional)" name="description" placeholder="Big box, fragile" />
      <SubmitButton className="w-full sm:w-auto">Log parcel &amp; notify</SubmitButton>
    </ActionForm>
  );
}

export function HandoverControls({ slug, parcelId }: { slug: string; parcelId: string }) {
  const [mode, setMode] = useState<"idle" | "handover" | "return">("idle");
  const hidden = <input type="hidden" name="parcelId" value={parcelId} />;
  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <Button onClick={() => setMode("handover")}>
          <PackageCheck className="size-4" aria-hidden /> Hand over
        </Button>
        <Button variant="ghost" onClick={() => setMode("return")} aria-label="Mark as returned to courier">
          <Undo2 className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }
  if (mode === "return") {
    return (
      <ActionForm action={parcelOpAction.bind(null, slug, "return")} className="w-full space-y-2">
        {hidden}
        <TextField label="Why is it being returned?" name="notes" placeholder="Resident refused / not collected in 7 days" required />
        <div className="flex gap-2">
          <SubmitButton variant="danger">Mark returned</SubmitButton>
          <Button variant="ghost" onClick={() => setMode("idle")}>
            Back
          </Button>
        </div>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={parcelOpAction.bind(null, slug, "handover")} className="w-full space-y-2">
      {hidden}
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <TextField label="Pickup code" name="code" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" placeholder="0000" required className="text-center font-mono text-lg tracking-[0.3em]" />
        <TextField label="Collected by" name="collectedByName" placeholder="Name of person" required />
      </div>
      <div className="flex gap-2">
        <SubmitButton>Confirm handover</SubmitButton>
        <Button variant="ghost" onClick={() => setMode("idle")}>
          Back
        </Button>
      </div>
    </ActionForm>
  );
}
