import { Building2 } from "lucide-react";

import { authorizePage, requirePageContext } from "@/lib/auth/page";
import { societyService } from "@/server/services/societyService";
import { createBuildingAction, createUnitAction } from "@/features/society/mutations";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, SubmitButton, TextField } from "@/components/forms/fields";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";

export const metadata = { title: "Buildings & units" };

export default async function SetupPage({ params }: PageProps<"/s/[slug]/setup">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "building.manage");
  const [buildings, units] = await Promise.all([societyService.listBuildings(ctx), societyService.listUnits(ctx)]);

  return (
    <>
      <PageHeader
        title="Buildings & units"
        description="Add each wing or tower, then the flats in it. Residents are invited per unit."
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <Panel title="Add building">
            <ActionForm action={createBuildingAction.bind(null, slug)} className="space-y-3" successMessage="Building added.">
              <TextField label="Name" name="name" placeholder="Wing A" required />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Code" name="code" placeholder="A" required />
                <TextField label="Floors" name="floors" type="number" min={1} required />
              </div>
              <SubmitButton>Add building</SubmitButton>
            </ActionForm>
          </Panel>
          <Panel title="Add unit">
            {buildings.length === 0 ? (
              <p className="text-sm text-muted">Add a building first.</p>
            ) : (
              <ActionForm action={createUnitAction.bind(null, slug)} className="space-y-3" successMessage="Unit added.">
                <SelectField label="Building" name="buildingId" required defaultValue="">
                  <option value="" disabled>
                    Choose building
                  </option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} · {b.name}
                    </option>
                  ))}
                </SelectField>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Unit number" name="unitNumber" placeholder="A-101" required />
                  <TextField label="Floor" name="floor" type="number" min={0} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Type (optional)" name="unitType" placeholder="2BHK" />
                  <TextField label="Area sq ft (optional)" name="areaSqft" type="number" min={1} />
                </div>
                <SubmitButton>Add unit</SubmitButton>
              </ActionForm>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-bold">Buildings ({buildings.length})</h2>
            {buildings.length === 0 ? (
              <EmptyState icon={Building2} title="No buildings yet" body="Start with your first wing or tower." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {buildings.map((b) => (
                  <div key={b.id} className="rounded-xl bg-surface px-4 py-3 text-sm shadow-sm ring-1 ring-border">
                    <span className="mr-1 rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-black text-primary">{b.code}</span>{" "}
                    <span className="text-muted">
                      {b.name} · {b.floors} {b.floors === 1 ? "floor" : "floors"} · {b._count.units} {b._count.units === 1 ? "unit" : "units"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-bold">Units ({units.length})</h2>
            {units.length === 0 ? (
              <EmptyState icon={Building2} title="No units yet" body="Add units so residents can be invited to them." />
            ) : (
              <div className="overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-bg">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Unit</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Building</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Floor</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Type</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">People</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {units.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-bg">
                        <td className="px-4 py-3 font-semibold">{u.unitNumber}</td>
                        <td className="px-4 py-3">{u.building.code}</td>
                        <td className="px-4 py-3 tabular-nums">{u.floor}</td>
                        <td className="px-4 py-3 text-muted">{u.unitType ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">
                          {u.members.map((m) => m.member.user.name).join(", ") || "No one yet"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
