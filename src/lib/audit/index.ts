import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { DbOrTx } from "@/lib/db/client";

export interface AuditInput {
  societyId: string | null;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

/** Append-only audit writer. Pass the transaction client so audit commits atomically with the change. */
export const audit = {
  async log(client: DbOrTx, input: AuditInput): Promise<void> {
    await client.auditLog.create({ data: input });
  },
};
