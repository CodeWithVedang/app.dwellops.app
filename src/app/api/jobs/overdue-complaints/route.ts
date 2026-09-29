import { timingSafeEqual } from "node:crypto";
import { runOverdueComplaintAlerts } from "@/server/jobs/overdueComplaints";

// Manual trigger; the Render worker (src/worker) runs this job on a schedule. Requires `Authorization: Bearer $CRON_SECRET`.
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const result = await runOverdueComplaintAlerts();
  return Response.json({ data: result });
}
