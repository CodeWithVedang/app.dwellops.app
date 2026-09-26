"use client";

import { useState, type ReactNode } from "react";
import { Pencil, Trash2, UserCheck, UserX } from "lucide-react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { adminOpAction } from "@/features/society/mutations";
import { ROLE_LABEL } from "@/features/society/constants";
import type { OccupancyStatus, SocietyRole } from "@/generated/prisma/enums";

type Op = Parameters<typeof adminOpAction>[1];

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-lg p-1.5 text-subtle transition-colors hover:bg-bg ${danger ? "hover:text-danger" : "hover:text-text"}`}
    >
      {children}
    </button>
  );
}

/** Confirmation dialog for destructive or access-changing actions. */
function ConfirmForm({ slug, op, hidden, body, confirm, onDone, danger = true }: { slug: string; op: Op; hidden: Record<string, string>; body: ReactNode; confirm: string; onDone: () => void; danger?: boolean }) {
  return (
    <ActionForm action={adminOpAction.bind(null, slug, op)} onSuccess={onDone} className="space-y-4">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="text-sm text-muted">{body}</div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton variant={danger ? "danger" : "primary"}>{confirm}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BuildingActions({ slug, b }: { slug: string; b: { id: string; name: string; code: string; floors: number; units: number } }) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const close = () => setMode(null);
  return (
    <span className="inline-flex">
      <IconButton label={`Edit ${b.name}`} onClick={() => setMode("edit")}>
        <Pencil className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton label={`Delete ${b.name}`} onClick={() => setMode("delete")} danger>
        <Trash2 className="size-3.5" aria-hidden />
      </IconButton>
      <Dialog open={mode === "edit"} onClose={close} title={`Edit ${b.name}`}>
        <ActionForm action={adminOpAction.bind(null, slug, "updateBuilding")} onSuccess={close} className="space-y-3" resetOnSuccess={false}>
          <input type="hidden" name="buildingId" value={b.id} />
          <TextField label="Name" name="name" defaultValue={b.name} required />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Code" name="code" defaultValue={b.code} required />
            <TextField label="Floors" name="floors" type="number" min={1} defaultValue={b.floors} required />
          </div>
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Dialog>
      <Dialog open={mode === "delete"} onClose={close} title={`Delete ${b.name}?`}>
        <ConfirmForm
          slug={slug}
          op="deleteBuilding"
          hidden={{ id: b.id }}
          onDone={close}
          confirm="Delete building"
          body={b.units > 0 ? `It still has ${b.units} flat${b.units === 1 ? "" : "s"}; you'll need to delete or move those first.` : "This can't be undone."}
        />
      </Dialog>
    </span>
  );
}

interface UnitRow {
  id: string;
  unitNumber: string;
  floor: number;
  unitType: string | null;
  areaSqft: number | null;
  occupancy: OccupancyStatus;
  linked: number;
}

export function UnitActions({ slug, u }: { slug: string; u: UnitRow }) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const close = () => setMode(null);
  return (
    <span className="inline-flex">
      <IconButton label={`Edit flat ${u.unitNumber}`} onClick={() => setMode("edit")}>
        <Pencil className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton label={`Delete flat ${u.unitNumber}`} onClick={() => setMode("delete")} danger>
        <Trash2 className="size-3.5" aria-hidden />
      </IconButton>
      <Dialog open={mode === "edit"} onClose={close} title={`Edit flat ${u.unitNumber}`}>
        <ActionForm action={adminOpAction.bind(null, slug, "updateUnit")} onSuccess={close} className="space-y-3" resetOnSuccess={false}>
          <input type="hidden" name="unitId" value={u.id} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Unit number" name="unitNumber" defaultValue={u.unitNumber} required />
            <TextField label="Floor" name="floor" type="number" min={0} defaultValue={u.floor} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Type" name="unitType" defaultValue={u.unitType ?? ""} placeholder="2BHK" />
            <TextField label="Area sq ft" name="areaSqft" type="number" min={1} defaultValue={u.areaSqft ?? ""} />
          </div>
          <SelectField label="Occupancy" name="occupancy" defaultValue={u.occupancy}>
            <option value="VACANT">Vacant</option>
            <option value="OWNER_OCCUPIED">Owner lives here</option>
            <option value="TENANT_OCCUPIED">Rented out</option>
          </SelectField>
          <SubmitButton>Save changes</SubmitButton>
        </ActionForm>
      </Dialog>
      <Dialog open={mode === "delete"} onClose={close} title={`Delete flat ${u.unitNumber}?`}>
        <ConfirmForm
          slug={slug}
          op="deleteUnit"
          hidden={{ id: u.id }}
          onDone={close}
          confirm="Delete flat"
          body={u.linked > 0 ? "People, complaints or parcels are linked to this flat, so it can't be deleted. Edit it instead." : "This can't be undone."}
        />
      </Dialog>
    </span>
  );
}

interface MemberRow {
  id: string;
  name: string;
  role: SocietyRole;
  status: "ACTIVE" | "INVITED" | "DISABLED";
}

export function MemberActions({ slug, m, canAdmin, isSelf }: { slug: string; m: MemberRow; canAdmin: boolean; isSelf: boolean }) {
  const [mode, setMode] = useState<"role" | "status" | null>(null);
  const close = () => setMode(null);
  const adminLocked = m.role === "SOCIETY_ADMIN" && !canAdmin;
  if (adminLocked) return <span className="text-xs text-subtle">—</span>;
  const disabling = m.status === "ACTIVE";
  const roles = (Object.keys(ROLE_LABEL) as SocietyRole[]).filter((r) => canAdmin || r !== "SOCIETY_ADMIN");
  return (
    <span className="inline-flex">
      <IconButton label={`Change role of ${m.name}`} onClick={() => setMode("role")}>
        <Pencil className="size-3.5" aria-hidden />
      </IconButton>
      <IconButton label={disabling ? `Remove ${m.name}` : `Restore ${m.name}`} onClick={() => setMode("status")} danger={disabling}>
        {disabling ? <UserX className="size-3.5" aria-hidden /> : <UserCheck className="size-3.5" aria-hidden />}
      </IconButton>
      <Dialog open={mode === "role"} onClose={close} title={`Change role: ${m.name}`}>
        <ActionForm action={adminOpAction.bind(null, slug, "changeRole")} onSuccess={close} className="space-y-3" resetOnSuccess={false}>
          <input type="hidden" name="memberId" value={m.id} />
          <SelectField label="Role" name="role" defaultValue={m.role}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </SelectField>
          <SubmitButton>Save role</SubmitButton>
        </ActionForm>
      </Dialog>
      <Dialog open={mode === "status"} onClose={close} title={disabling ? `Remove ${m.name}?` : `Restore ${m.name}?`}>
        <ConfirmForm
          slug={slug}
          op="setMemberStatus"
          hidden={{ memberId: m.id, status: disabling ? "DISABLED" : "ACTIVE" }}
          onDone={close}
          danger={disabling}
          confirm={disabling ? "Remove access" : "Restore access"}
          body={
            disabling
              ? `${isSelf ? "You" : m.name} will lose access to this society immediately. Their complaints and history stay. You can restore access later.`
              : `${m.name} will get access again with the same role.`
          }
        />
      </Dialog>
    </span>
  );
}

export function RevokeInvite({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={`Cancel invite for ${name}`} onClick={() => setOpen(true)} danger>
        <Trash2 className="size-3.5" aria-hidden />
      </IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Cancel invite for ${name}?`}>
        <ConfirmForm slug={slug} op="revokeInvite" hidden={{ id }} onDone={() => setOpen(false)} confirm="Cancel invite" body="The invite link will stop working." />
      </Dialog>
    </>
  );
}
