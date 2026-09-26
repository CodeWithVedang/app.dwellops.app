import { requirePageContext } from "@/lib/auth/page";
import { Bell } from "lucide-react";
import Link from "next/link";

import { activityService } from "@/server/services/activityService";
import { markAllReadAction } from "@/features/notifications/mutations";
import { EmptyState, PageHeader } from "@/components/ui/feedback";
import { buttonClass } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/s/[slug]/notifications">) {
  const { slug } = await params;
  const ctx = await requirePageContext(slug);
  const items = await activityService.listNotifications(ctx);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={
          unread > 0 && (
            <form action={markAllReadAction.bind(null, slug)}>
              <button className={buttonClass("secondary")}>Mark all as read</button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" body="Updates about your complaints and assignments will show up here." />
      ) : (
        <ul className="divide-y divide-border rounded-xl bg-surface shadow-sm ring-1 ring-border">
          {items.map((n) => {
            const body = (
              <>
                <span className="flex items-center gap-2">
                  {!n.readAt && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
                  <span className={n.readAt ? "" : "font-medium"}>{n.title}</span>
                </span>
                <span className="mt-0.5 block text-sm text-muted">{n.body}</span>
                <span className="mt-0.5 block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
              </>
            );
            // Only follow internal links.
            const safeLink = n.link?.startsWith("/") && !n.link.startsWith("//") ? n.link : null;
            return (
              <li key={n.id}>
                {safeLink ? (
                  <Link href={safeLink} className="block px-4 py-3 hover:bg-bg">
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
