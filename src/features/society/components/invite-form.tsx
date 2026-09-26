"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { inviteMemberAction } from "@/features/society/mutations";
import { ROLE_LABEL } from "@/features/society/constants";
import type { SocietyRole } from "@/generated/prisma/enums";

interface Props {
  slug: string;
  units: { id: string; label: string }[];
  canInviteAdmin: boolean;
}

export function InviteForm({ slug, units, canInviteAdmin }: Props) {
  const [role, setRole] = useState<SocietyRole>("RESIDENT");
  const needsUnit = role === "RESIDENT" || role === "TENANT";
  const roles = (Object.keys(ROLE_LABEL) as SocietyRole[]).filter((r) => canInviteAdmin || r !== "SOCIETY_ADMIN");

  return (
    <ActionForm<{ inviteUrl: string; email: string; emailed: boolean }>
      action={inviteMemberAction.bind(null, slug)}
      className="space-y-3"
      successMessage={(d) => (
        <span>
          {d.emailed
            ? `Invite emailed to ${d.email}. You can also share this link on WhatsApp (valid 7 days):`
            : `We couldn't email ${d.email} right now. Share this link with them instead (valid 7 days):`}
          <input
            readOnly
            value={d.inviteUrl}
            aria-label="Invite link"
            className="mt-2 block w-full rounded border border-green-300 bg-white px-2 py-1 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        </span>
      )}
    >
      <TextField label="Name" name="name" required />
      <TextField label="Email" name="email" type="email" required />
      <SelectField label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value as SocietyRole)}>
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </SelectField>
      {needsUnit && (
        <SelectField label="Unit" name="unitId" defaultValue="" required>
          <option value="" disabled>
            {units.length ? "Choose unit" : "Add units first"}
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </SelectField>
      )}
      <SubmitButton>Create invite</SubmitButton>
    </ActionForm>
  );
}
