"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { complaintOpAction } from "@/features/complaints/mutations";
import { ROLE_LABEL } from "@/features/society/constants";
import type { ComplaintStatus, SocietyRole } from "@/generated/prisma/enums";

export interface AllowedActions {
  acknowledge: boolean;
  assign: boolean;
  start: boolean;
  wait: boolean;
  resolve: boolean;
  decide: boolean;
  cancel: boolean;
}

interface Props {
  slug: string;
  complaintId: string;
  status: ComplaintStatus;
  allowed: AllowedActions;
  assignees: { id: string; role: SocietyRole; name: string }[];
  currentAssigneeId: string | null;
}

type Panel = "assign" | "resolve" | "reopen" | "wait" | "cancel" | null;

/** Next-step actions for a complaint. Server re-checks every permission and transition. */
export function ComplaintActions({ slug, complaintId, status, allowed, assignees, currentAssigneeId }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const op = (name: "assign" | "status" | "resolve" | "decision") => complaintOpAction.bind(null, slug, name);
  const hidden = <input type="hidden" name="complaintId" value={complaintId} />;
  const anything = Object.values(allowed).some(Boolean);
  if (!anything) return null;

  return (
    <section aria-label="Actions" className="rounded-xl bg-surface p-5 shadow-sm ring-1 ring-border">
      <h2 className="text-sm font-semibold">Next step</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {allowed.decide && (
          <>
            <ActionForm action={op("decision")}>
              {hidden}
              <input type="hidden" name="decision" value="CONFIRM" />
              <SubmitButton>Yes, it’s fixed</SubmitButton>
            </ActionForm>
            <Button variant="secondary" onClick={() => setPanel("reopen")}>Not fixed — reopen</Button>
          </>
        )}
        {allowed.acknowledge && (
          <ActionForm action={op("status")}>
            {hidden}
            <input type="hidden" name="status" value="ACKNOWLEDGED" />
            <SubmitButton variant="secondary">Acknowledge</SubmitButton>
          </ActionForm>
        )}
        {allowed.assign && <Button onClick={() => setPanel("assign")}>{currentAssigneeId ? "Reassign" : "Assign"}</Button>}
        {allowed.start && (
          <ActionForm action={op("status")}>
            {hidden}
            <input type="hidden" name="status" value="IN_PROGRESS" />
            <SubmitButton>{status === "WAITING" ? "Resume work" : "Start work"}</SubmitButton>
          </ActionForm>
        )}
        {allowed.resolve && <Button onClick={() => setPanel("resolve")}>Mark as resolved</Button>}
        {allowed.wait && <Button variant="secondary" onClick={() => setPanel("wait")}>Waiting on something</Button>}
        {allowed.cancel && <Button variant="ghost" onClick={() => setPanel("cancel")}>Cancel complaint</Button>}
      </div>

      {panel === "assign" && (
        <ActionForm action={op("assign")} className="mt-4 space-y-3 border-t border-border pt-4" successMessage="Assigned.">
          {hidden}
          {assignees.length === 0 ? (
            <p className="text-sm text-muted">No staff or vendors yet. Invite them from People first.</p>
          ) : (
            <>
              <SelectField label="Who will handle it?" name="assigneeId" defaultValue={currentAssigneeId ?? ""} required>
                <option value="" disabled>
                  Choose person
                </option>
                {assignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({ROLE_LABEL[a.role]})
                  </option>
                ))}
              </SelectField>
              <TextField label="Expected completion (optional)" name="expectedCompletion" type="datetime-local" />
              <TextAreaField label="Note for assignee (optional)" name="note" rows={2} />
              <PanelButtons onCancel={() => setPanel(null)} label="Assign" />
            </>
          )}
        </ActionForm>
      )}

      {panel === "resolve" && (
        <ActionForm action={op("resolve")} className="mt-4 space-y-3 border-t border-border pt-4">
          {hidden}
          <TextAreaField label="What was done?" name="resolutionNote" rows={3} required />
          <TextField label="Cost in ₹ (optional)" name="cost" inputMode="decimal" placeholder="1250.00" />
          <PanelButtons onCancel={() => setPanel(null)} label="Mark as resolved" />
        </ActionForm>
      )}

      {panel === "reopen" && (
        <ActionForm action={op("decision")} className="mt-4 space-y-3 border-t border-border pt-4">
          {hidden}
          <input type="hidden" name="decision" value="REOPEN" />
          <TextAreaField label="What is still wrong?" name="note" rows={3} required />
          <PanelButtons onCancel={() => setPanel(null)} label="Reopen complaint" />
        </ActionForm>
      )}

      {panel === "wait" && (
        <ActionForm action={op("status")} className="mt-4 space-y-3 border-t border-border pt-4">
          {hidden}
          <input type="hidden" name="status" value="WAITING" />
          <TextAreaField label="What are you waiting on?" name="note" rows={2} placeholder="Spare part arriving Monday" />
          <PanelButtons onCancel={() => setPanel(null)} label="Mark as waiting" />
        </ActionForm>
      )}

      {panel === "cancel" && (
        <ActionForm action={op("status")} className="mt-4 space-y-3 border-t border-border pt-4">
          {hidden}
          <input type="hidden" name="status" value="CANCELLED" />
          <p className="text-sm text-muted">Cancelling stops all work on this complaint. This can’t be undone.</p>
          <TextAreaField label="Reason (optional)" name="note" rows={2} />
          <PanelButtons onCancel={() => setPanel(null)} label="Yes, cancel complaint" danger />
        </ActionForm>
      )}
    </section>
  );
}

function PanelButtons({ onCancel, label, danger }: { onCancel: () => void; label: string; danger?: boolean }) {
  return (
    <div className="flex gap-2">
      <SubmitButton variant={danger ? "danger" : "primary"}>{label}</SubmitButton>
      <Button variant="ghost" onClick={onCancel}>
        Back
      </Button>
    </div>
  );
}
