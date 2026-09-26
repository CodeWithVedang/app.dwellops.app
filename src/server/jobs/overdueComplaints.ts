import "server-only";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { notify } from "@/lib/notifications";
import { OPEN_STATUSES } from "@/features/complaints/constants";

const BATCH = 200;

/**
 * Alerts the owner (or the managers, if nobody owns it) once when a complaint passes its due time.
 * Safe to run repeatedly and concurrently: each complaint is claimed with a conditional update
 * before notifying, and notifications are de-duplicated per complaint + user.
 */
export async function runOverdueComplaintAlerts(now = new Date()): Promise<{ alerted: number }> {
  const due = await db.complaint.findMany({
    where: { status: { in: OPEN_STATUSES }, dueAt: { lt: now }, overdueNotifiedAt: null },
    orderBy: { dueAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      number: true,
      title: true,
      societyId: true,
      society: { select: { slug: true } },
      assignee: { select: { userId: true, status: true } },
    },
  });

  let alerted = 0;
  for (const c of due) {
    const claimed = await db.complaint.updateMany({ where: { id: c.id, overdueNotifiedAt: null }, data: { overdueNotifiedAt: now } });
    if (claimed.count !== 1) continue; // another run took it

    const recipients =
      c.assignee && c.assignee.status === "ACTIVE"
        ? [c.assignee.userId]
        : (
            await db.societyMember.findMany({
              where: { societyId: c.societyId, status: "ACTIVE", role: { in: ["SOCIETY_ADMIN", "SOCIETY_MANAGER"] } },
              select: { userId: true },
            })
          ).map((m) => m.userId);

    for (const userId of new Set(recipients)) {
      await notify({
        societyId: c.societyId,
        userId,
        dedupeKey: `complaint:${c.id}:overdue`,
        template: "complaint.overdue",
        title: `⏰ Complaint #${c.number} is overdue`,
        body: c.title,
        link: `/s/${c.society.slug}/complaints/${c.id}`,
      });
    }
    alerted++;
  }
  if (alerted) logger.info("overdue complaint alerts sent", { alerted });
  return { alerted };
}
