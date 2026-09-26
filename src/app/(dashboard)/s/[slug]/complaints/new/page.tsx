import { unitLabel } from "@/lib/units";
import { hasPermission } from "@/lib/auth/context";
import { authorizePage, requirePageContext } from "@/lib/auth/page";
import { societyService } from "@/server/services/societyService";
import { createComplaintAction } from "@/features/complaints/mutations";
import { COMPLAINT_CATEGORIES, PRIORITIES } from "@/features/complaints/constants";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/fields";
import { PageHeader } from "@/components/ui/feedback";

export const metadata = { title: "Raise complaint" };

export default async function NewComplaintPage({ params }: PageProps<"/s/[slug]/complaints/new">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "complaint.create");
  const manager = hasPermission(ctx, "complaint.view_all");
  const units = manager
    ? (await societyService.listUnits(ctx)).map((u) => ({ id: u.id, unitNumber: u.unitNumber, building: u.building }))
    : await societyService.myUnits(ctx);

  return (
    <div className="max-w-2xl">
      <PageHeader title="Raise a complaint" description="Tell us what's wrong. The society office will assign someone and you'll get updates here." />
      <ActionForm action={createComplaintAction.bind(null, slug)} className="space-y-4 rounded-xl bg-surface p-6 shadow-sm ring-1 ring-border" resetOnSuccess={false}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="What kind of problem?" name="category" defaultValue="" required>
            <option value="" disabled>
              Choose category
            </option>
            {COMPLAINT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.emoji} {c.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="How urgent?" name="priority" defaultValue="NORMAL">
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </SelectField>
        </div>
        <TextField label="Title" name="title" placeholder="Kitchen tap leaking" required maxLength={120} />
        <TextAreaField label="Details" name="description" placeholder="What happened, since when, anything we should know." required maxLength={4000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Unit" name="unitId" defaultValue={!manager && units.length === 1 ? units[0]?.id : ""}>
            <option value="">Common area / not a unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {unitLabel(u)}
              </option>
            ))}
          </SelectField>
          <TextField label="Exact location (optional)" name="location" placeholder="Kitchen, near sink" />
        </div>
        <TextField label="Best time to visit (optional)" name="preferredAccessTime" placeholder="Weekdays after 6 pm" />
        <div className="flex justify-end">
          <SubmitButton>Submit complaint</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
