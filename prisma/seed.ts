// DEVELOPMENT DATA ONLY. Refuses to run in production.
// Creates one society with a manager, resident and staff member so the UI can be exercised locally.
// Login: admin@ / resident@ / staff@ / guard@dev.dwellops.test — password: dev-password-123
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (process.env.NODE_ENV === "production") throw new Error("Seed is development-only.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const PASSWORD = "dev-password-123";
const HOUR = 3600_000;

/** Notices, parcels and a guard account. Safe to re-run: skips when notices already exist. */
async function seedCommunity() {
  const society = await db.society.findUniqueOrThrow({ where: { slug: "dev-green-meadows" } });
  if (await db.notice.count({ where: { societyId: society.id } })) return;
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@dev.dwellops.test" } });
  const guardUser =
    (await db.user.findUnique({ where: { email: "guard@dev.dwellops.test" } })) ??
    (await db.user.create({
      data: { email: "guard@dev.dwellops.test", name: "Ramesh Yadav", passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }), emailVerifiedAt: new Date() },
    }));
  await db.societyMember.upsert({
    where: { societyId_userId_role: { societyId: society.id, userId: guardUser.id, role: "SECURITY_MANAGER" } },
    create: { societyId: society.id, userId: guardUser.id, role: "SECURITY_MANAGER" },
    update: {},
  });
  const now = Date.now();
  await db.notice.createMany({
    data: [
      {
        societyId: society.id,
        createdById: admin.id,
        title: "Water supply off on Sunday, 10 am to 2 pm",
        body: "Overhead tanks in Wing A and B will be cleaned. Please store enough water on Saturday night.",
        category: "WATER",
        priority: "IMPORTANT",
        requiresAck: true,
        pinned: true,
        status: "PUBLISHED",
        publishedAt: new Date(now - 5 * HOUR),
      },
      {
        societyId: society.id,
        createdById: admin.id,
        title: "Annual general body meeting on 12 October",
        body: "Clubhouse, 11 am.\n\nAgenda:\n1. Accounts for last year\n2. Lift replacement quotes\n3. Parking allotment policy",
        category: "MEETING",
        status: "PUBLISHED",
        publishedAt: new Date(now - 26 * HOUR),
      },
      {
        societyId: society.id,
        createdById: admin.id,
        title: "Navratri celebration — volunteers needed",
        body: "Garba nights in the podium from 3 to 11 October. Reply at the office if you can help with decoration.",
        category: "EVENT",
        status: "PUBLISHED",
        publishedAt: new Date(now - 50 * HOUR),
      },
    ],
  });
  const unit = await db.unit.findFirstOrThrow({ where: { societyId: society.id, unitNumber: "A-101" } });
  await db.parcel.createMany({
    data: [
      { societyId: society.id, number: 1, unitId: unit.id, courier: "Amazon", pickupCode: "4821", status: "NOTIFIED", receivedById: guardUser.id, storageLocation: "Rack 2", receivedAt: new Date(now - 3 * HOUR) },
      { societyId: society.id, number: 2, unitId: unit.id, courier: "Blue Dart", pickupCode: "1937", status: "NOTIFIED", receivedById: guardUser.id, receivedAt: new Date(now - 60 * HOUR) },
    ],
  });
  console.log("Dev community data added (guard@dev.dwellops.test).");
}

async function main() {
  if (await db.society.findUnique({ where: { slug: "dev-green-meadows" } })) {
    await seedCommunity();
    return;
  }
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const mkUser = (email: string, name: string) =>
    db.user.create({ data: { email, name, passwordHash, emailVerifiedAt: new Date() } });

  const [admin, resident, staff] = await Promise.all([
    mkUser("admin@dev.dwellops.test", "Asha Kulkarni"),
    mkUser("resident@dev.dwellops.test", "Ravi Mehta"),
    mkUser("staff@dev.dwellops.test", "Sunil Pawar"),
  ]);

  const society = await db.society.create({
    data: { slug: "dev-green-meadows", name: "Green Meadows CHS (dev)", address: "12 Baner Road", city: "Pune", state: "Maharashtra" },
  });
  const [mAdmin, mResident, mStaff] = await Promise.all([
    db.societyMember.create({ data: { societyId: society.id, userId: admin.id, role: "SOCIETY_ADMIN" } }),
    db.societyMember.create({ data: { societyId: society.id, userId: resident.id, role: "RESIDENT" } }),
    db.societyMember.create({ data: { societyId: society.id, userId: staff.id, role: "STAFF" } }),
  ]);

  const wingA = await db.building.create({ data: { societyId: society.id, name: "Wing A", code: "A", floors: 7 } });
  await db.building.create({ data: { societyId: society.id, name: "Wing B", code: "B", floors: 7 } });
  const units = await Promise.all(
    ["A-101", "A-102", "A-201", "A-202", "A-301"].map((n) =>
      db.unit.create({ data: { societyId: society.id, buildingId: wingA.id, unitNumber: n, floor: Number(n[2]), unitType: "2BHK", occupancy: "OWNER_OCCUPIED" } }),
    ),
  );
  await db.unitMember.create({ data: { unitId: units[0]!.id, memberId: mResident.id, relation: "OWNER" } });

  const now = Date.now();
  const complaints = [
    { title: "Kitchen tap leaking", category: "PLUMBING", priority: "HIGH", status: "NEW", ageH: 3, due: 12 },
    { title: "Corridor light not working on 2nd floor", category: "ELECTRICAL", priority: "NORMAL", status: "ASSIGNED", ageH: 30, due: 48 },
    { title: "Lift making grinding noise", category: "LIFT", priority: "CRITICAL", status: "IN_PROGRESS", ageH: 9, due: 4 },
    { title: "Seepage in bathroom ceiling", category: "CIVIL", priority: "NORMAL", status: "RESOLVED", ageH: 70, due: 48 },
  ] as const;
  let number = 0;
  for (const c of complaints) {
    number += 1;
    const createdAt = new Date(now - c.ageH * HOUR);
    const assigned = c.status !== "NEW";
    const row = await db.complaint.create({
      data: {
        societyId: society.id,
        number,
        unitId: units[0]!.id,
        raisedById: mResident.id,
        assigneeId: assigned ? mStaff.id : null,
        category: c.category,
        title: c.title,
        description: `${c.title}. Please check at the earliest.`,
        priority: c.priority,
        status: c.status,
        createdAt,
        dueAt: new Date(createdAt.getTime() + c.due * HOUR),
        resolutionNote: c.status === "RESOLVED" ? "Resealed the pipe joint above the ceiling." : null,
        resolvedAt: c.status === "RESOLVED" ? new Date(now - 2 * HOUR) : null,
      },
    });
    await db.complaintActivity.create({ data: { complaintId: row.id, actorId: resident.id, type: "CREATED", toStatus: "NEW", createdAt } });
    if (assigned) {
      await db.complaintActivity.create({
        data: { complaintId: row.id, actorId: admin.id, type: "ASSIGNED", fromStatus: "NEW", toStatus: "ASSIGNED", note: `Assigned to ${staff.name}`, createdAt: new Date(createdAt.getTime() + HOUR) },
      });
    }
    await db.auditLog.create({
      data: { societyId: society.id, actorId: resident.id, action: "complaint.created", entityType: "Complaint", entityId: row.id, after: { number, title: c.title }, createdAt },
    });
  }
  await seedCommunity();
  console.log(`Dev seed created. Sign in with admin@dev.dwellops.test / ${PASSWORD}`);
  void mAdmin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
