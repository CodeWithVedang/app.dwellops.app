import "server-only";
import type { NotificationChannel } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface NotificationInput {
  societyId: string;
  userId: string;
  /** Stable key for the triggering event, e.g. `complaint:<id>:assigned:<assigneeId>`. */
  dedupeKey: string;
  template: string;
  title: string;
  body: string;
  link?: string;
}

export interface NotificationResult {
  delivered: boolean;
  providerMessageId?: string;
  failureReason?: string;
}

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(input: NotificationInput): Promise<NotificationResult>;
}

/** In-app: the persisted record itself is the delivery. */
export class InAppNotificationProvider implements NotificationProvider {
  readonly channel = "IN_APP" as const;
  async send(): Promise<NotificationResult> {
    return { delivered: true };
  }
}

const providers: NotificationProvider[] = [new InAppNotificationProvider()];

/**
 * Idempotent fan-out: a (dedupeKey, user, channel) row is created once; retries skip already-sent rows.
 * Called after the business transaction commits so failures never roll back the operation.
 */
export async function notify(input: NotificationInput): Promise<void> {
  for (const provider of providers) {
    try {
      const row = await db.notification.upsert({
        where: { dedupeKey_userId_channel: { dedupeKey: input.dedupeKey, userId: input.userId, channel: provider.channel } },
        create: { ...input, channel: provider.channel },
        update: {},
      });
      if (row.deliveryStatus === "SENT") continue;
      const result = await provider.send(input);
      await db.notification.update({
        where: { id: row.id },
        data: result.delivered
          ? { deliveryStatus: "SENT", sentAt: new Date(), providerMsgId: result.providerMessageId ?? null }
          : { deliveryStatus: "FAILED", failureReason: result.failureReason ?? "unknown" },
      });
    } catch (err) {
      logger.error("notification failed", {
        channel: provider.channel,
        dedupeKey: input.dedupeKey,
        userId: input.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
