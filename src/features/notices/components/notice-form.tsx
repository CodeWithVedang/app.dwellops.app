"use client";

import { useState } from "react";
import { ActionForm, useFormErrors } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { createNoticeAction } from "@/features/notices/mutations";
import { AUDIENCE_LABEL, CATEGORY_META } from "@/features/notices/domain";
import type { NoticeAudience, NoticeCategory } from "@/generated/prisma/enums";

interface Props {
  slug: string;
  buildings: { id: string; name: string }[];
}

const TEMPLATES: { label: string; category: NoticeCategory; title: string; body: string; ack: boolean }[] = [
  {
    label: "Water cut",
    category: "WATER",
    title: "Water supply off on [day], [time] to [time]",
    body: "Water supply will be off for tank cleaning. Please store enough water in advance. We regret the inconvenience.",
    ack: true,
  },
  {
    label: "Power shutdown",
    category: "ELECTRICITY",
    title: "Power shutdown on [day] for maintenance",
    body: "Common-area power and lifts will be off from [time] to [time] for scheduled maintenance.",
    ack: true,
  },
  {
    label: "Meeting",
    category: "MEETING",
    title: "General body meeting on [date]",
    body: "All members are requested to attend the meeting at [place], [time].\n\nAgenda:\n1. \n2. ",
    ack: false,
  },
  {
    label: "Pest control",
    category: "MAINTENANCE_WORK",
    title: "Pest control in common areas on [day]",
    body: "Pest control will be done in staircases, lobbies and parking. Please keep children and pets away between [time] and [time].",
    ack: false,
  },
];

function Actions() {
  const { pending } = useFormErrors();
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button type="submit" name="intent" value="draft" variant="secondary" pending={pending}>
        Save as draft
      </Button>
      <Button type="submit" name="intent" value="publish" pending={pending}>
        Publish &amp; notify
      </Button>
    </div>
  );
}

export function NoticeForm({ slug, buildings }: Props) {
  const [audience, setAudience] = useState<NoticeAudience>("ALL");
  const [draft, setDraft] = useState({ category: "GENERAL" as NoticeCategory, title: "", body: "", ack: false, key: 0 });

  return (
    <ActionForm action={createNoticeAction.bind(null, slug)} className="space-y-5" resetOnSuccess={false}>
      <div>
        <p className="text-[13px] font-semibold">Start from a template</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setDraft({ category: t.category, title: t.title, body: t.body, ack: t.ack, key: draft.key + 1 })}
              className="rounded-full bg-bg px-3 py-1.5 text-[13px] font-medium text-text ring-1 ring-border transition-colors hover:bg-primary-soft hover:text-primary-strong hover:ring-primary-ring"
            >
              {CATEGORY_META[t.category].emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div key={draft.key} className="space-y-4">
        <TextField label="Title" name="title" defaultValue={draft.title} required maxLength={140} placeholder="Short and specific, e.g. Lift B under repair till Friday" />
        <TextAreaField label="Details" name="body" defaultValue={draft.body} rows={6} required maxLength={5000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" name="category" defaultValue={draft.category}>
            {(Object.keys(CATEGORY_META) as NoticeCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </option>
            ))}
          </SelectField>
          <SelectField label="How important?" name="priority" defaultValue="NORMAL">
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Important</option>
            <option value="URGENT">Urgent — highlight for everyone</option>
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Who should see it?" name="audience" value={audience} onChange={(e) => setAudience(e.target.value as NoticeAudience)}>
            {(Object.keys(AUDIENCE_LABEL) as NoticeAudience[]).map((a) => (
              <option key={a} value={a} disabled={a === "BUILDING" && buildings.length === 0}>
                {AUDIENCE_LABEL[a]}
              </option>
            ))}
          </SelectField>
          {audience === "BUILDING" ? (
            <SelectField label="Building" name="buildingId" defaultValue="" required>
              <option value="" disabled>
                Choose building
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField label="Remove from board after (optional)" name="expiresAt" type="datetime-local" />
          )}
        </div>
        <fieldset className="space-y-2.5 rounded-xl bg-bg p-4">
          <legend className="sr-only">Options</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="pinned" className="mt-0.5 size-4 accent-[var(--color-primary)]" />
            <span>
              <span className="font-semibold">Pin to top</span>
              <span className="block text-xs text-muted">Keeps it above newer notices until you archive it.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="requiresAck" defaultChecked={draft.ack} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
            <span>
              <span className="font-semibold">Ask residents to confirm they&apos;ve seen it</span>
              <span className="block text-xs text-muted">You&apos;ll see exactly who hasn&apos;t — useful for water cuts and shutdowns.</span>
            </span>
          </label>
        </fieldset>
      </div>
      <Actions />
    </ActionForm>
  );
}
