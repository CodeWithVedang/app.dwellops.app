import Link from "next/link";
import { authorizePage, requirePageContext } from "@/lib/auth/page";
import { societyService } from "@/server/services/societyService";
import { PageHeader, Panel } from "@/components/ui/feedback";
import { NoticeForm } from "@/features/notices/components/notice-form";

export const metadata = { title: "Post notice" };

export default async function NewNoticePage({ params }: PageProps<"/s/[slug]/notices/new">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  authorizePage(ctx, "notice.manage");
  const buildings = await societyService.listBuildings(ctx);
  return (
    <div className="max-w-2xl">
      <Link href={`/s/${slug}/notices`} className="text-sm font-medium text-muted hover:text-text">
        ← Notice board
      </Link>
      <div className="mt-3">
        <PageHeader title="Post a notice" description="Residents in the audience get an in-app notification the moment you publish." />
      </div>
      <Panel>
        <NoticeForm slug={slug} buildings={buildings.map((b) => ({ id: b.id, name: b.name }))} />
      </Panel>
    </div>
  );
}
