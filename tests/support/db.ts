import { db } from "@/lib/db/client";
import { loadSocietyContext, type SocietyContext } from "@/lib/auth/context";
import { hashPassword } from "@/lib/auth/password";

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Refusing to run integration tests against a non-test database. Set TEST_DATABASE_URL.");
}

export { db };

export async function resetDb(): Promise<void> {
  // The audit trigger blocks UPDATE, not TRUNCATE.
  await db.$executeRawUnsafe(
    `TRUNCATE "email_tokens","notice_reads","notices","parcels","notifications","complaint_activities","complaints","unit_members","invitations","units","buildings","society_members","audit_logs","sessions","societies","users" CASCADE`,
  );
}

let n = 0;
export async function makeUser(name: string) {
  n += 1;
  return db.user.create({
    data: { email: `${name.toLowerCase()}${n}@example.test`, name, passwordHash: await hashPassword("correct-horse-battery") },
  });
}

export async function ctxFor(userId: string, slug: string): Promise<SocietyContext> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return loadSocietyContext({ id: u.id, email: u.email, name: u.name, emailVerified: true, sessionId: "test" }, slug);
}

export const sessionUser = (u: { id: string; email: string; name: string }) => ({ ...u, emailVerified: true, sessionId: "test" });
