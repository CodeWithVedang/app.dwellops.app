import { requirePageContext, authorizePage } from "@/lib/auth/page";
import { adminService } from "@/server/services/adminService";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { SettingsForm } from "@/features/society/components/settings-form";

export const metadata = { title: "Society settings" };

export default async function SettingsPage({ params }: PageProps<"/s/[slug]/settings">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "society.update");
  const s = await adminService.getSettings(ctx);
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Settings" title="Society settings" description="Details shown to residents, and how quickly complaints should be handled." />
      <Panel>
        <SettingsForm slug={slug} initial={{ ...s, contactEmail: s.contactEmail ?? "", contactPhone: s.contactPhone ?? "" }} />
      </Panel>
    </div>
  );
}
