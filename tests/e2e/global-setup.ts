import { Client } from "pg";

// Start every E2E run from an empty test database.
export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? "";
  if (!url.includes("_test")) throw new Error("Refusing to reset a non-test database.");
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(
    `TRUNCATE "notice_reads","notices","parcels","notifications","complaint_activities","complaints","unit_members","invitations","units","buildings","society_members","audit_logs","sessions","societies","users" CASCADE`,
  );
  await client.end();
}
