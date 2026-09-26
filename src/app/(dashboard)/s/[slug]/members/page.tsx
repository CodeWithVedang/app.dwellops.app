import { unitLabel } from "@/lib/units";
import { Users } from "lucide-react";
import { hasPermission } from "@/lib/auth/context";
import { authorizePage, requirePageContext } from "@/lib/auth/page";
import { societyService } from "@/server/services/societyService";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/features/society/constants";
import { InviteForm } from "@/features/society/components/invite-form";

export const metadata = { title: "People" };

export default async function MembersPage({ params }: PageProps<"/s/[slug]/members">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "member.view");
  const canInvite = hasPermission(ctx, "member.invite");
  const [members, invites, units] = await Promise.all([
    societyService.listMembers(ctx),
    canInvite ? societyService.listPendingInvites(ctx) : Promise.resolve([]),
    canInvite ? societyService.listUnits(ctx) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="People" description="Residents, committee, staff and vendors in this society." />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {canInvite && (
          <Panel title="Invite someone">
            <InviteForm
              slug={slug}
              units={units.map((u) => ({ id: u.id, label: unitLabel(u) }))}
              canInviteAdmin={ctx.roles.includes("SOCIETY_ADMIN")}
            />
          </Panel>
        )}
        <div className="space-y-6">
          {invites.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold">Waiting to join ({invites.length})</h2>
              <ul className="divide-y divide-border rounded-xl bg-surface shadow-sm ring-1 ring-border text-sm">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span>
                      <span className="font-medium">{i.name}</span> <span className="text-muted">{i.email}</span>
                    </span>
                    <span className="text-xs text-muted">
                      {ROLE_LABEL[i.role]}
                      {i.unit ? ` · ${unitLabel(i.unit)}` : ""} · expires{" "}
                      {i.expiresAt.toLocaleDateString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 text-sm font-bold">Members ({members.length})</h2>
            {members.length === 0 ? (
              <EmptyState icon={Users} title="No members" body="Invite your committee and residents." />
            ) : (
              <div className="overflow-x-auto rounded-xl bg-surface shadow-sm ring-1 ring-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-bg">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Name</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Role</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Unit</th>
                      <th scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {members.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-bg">
                        <td className="px-4 py-3">
                          <span className="font-medium">{m.user.name}</span>
                          <span className="block text-xs text-muted">{m.user.email}</span>
                        </td>
                        <td className="px-4 py-3">{ROLE_LABEL[m.role]}</td>
                        <td className="px-4 py-3 text-muted">
                          {m.unitLinks.map((l) => unitLabel(l.unit)).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {m.status === "ACTIVE" ? "Active" : m.status === "INVITED" ? "Invited" : "Disabled"}
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
