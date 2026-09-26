import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ComplaintStatus } from "@/generated/prisma/enums";
import type { DbOrTx } from "@/lib/db/client";

// Every method is scoped by societyId (tenant isolation).

export const complaintDetailInclude = {
  unit: { select: { id: true, unitNumber: true, building: { select: { code: true } } } },
  raisedBy: { select: { id: true, user: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, role: true, user: { select: { id: true, name: true } } } },
  activities: { orderBy: { createdAt: "asc" } },
  attachments: {
    orderBy: { createdAt: "asc" },
    select: { id: true, file: { select: { id: true, originalName: true, uploadedById: true, createdAt: true } } },
  },
} satisfies Prisma.ComplaintInclude;

export type ComplaintDetail = Prisma.ComplaintGetPayload<{ include: typeof complaintDetailInclude }>;

export const complaintRepository = {
  findById(client: DbOrTx, societyId: string, complaintId: string) {
    return client.complaint.findFirst({ where: { id: complaintId, societyId }, include: complaintDetailInclude });
  },

  async nextNumber(client: DbOrTx, societyId: string): Promise<number> {
    const last = await client.complaint.findFirst({ where: { societyId }, orderBy: { number: "desc" }, select: { number: true } });
    return (last?.number ?? 0) + 1;
  },

  list(client: DbOrTx, societyId: string, where: Prisma.ComplaintWhereInput, page: number, pageSize: number) {
    const scoped: Prisma.ComplaintWhereInput = { AND: [where, { societyId }] };
    return Promise.all([
      client.complaint.findMany({
        where: scoped,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          unit: { select: { unitNumber: true, building: { select: { code: true } } } },
          assignee: { select: { user: { select: { name: true } } } },
        },
      }),
      client.complaint.count({ where: scoped }),
    ]);
  },

  countByStatus(client: DbOrTx, societyId: string, where: Prisma.ComplaintWhereInput = {}) {
    return client.complaint.groupBy({ by: ["status"], where: { AND: [where, { societyId }] }, _count: { _all: true } });
  },

  countOverdue(client: DbOrTx, societyId: string, open: ComplaintStatus[], where: Prisma.ComplaintWhereInput = {}) {
    return client.complaint.count({ where: { AND: [where, { societyId, status: { in: open }, dueAt: { lt: new Date() } }] } });
  },

  /** Optimistic concurrency: update only if status unchanged since read. Returns rows affected. */
  async updateIfStatus(client: DbOrTx, societyId: string, id: string, expected: ComplaintStatus, data: Prisma.ComplaintUncheckedUpdateManyInput) {
    const r = await client.complaint.updateMany({ where: { id, societyId, status: expected }, data });
    return r.count;
  },
};
