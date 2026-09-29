import { randomUUID } from "node:crypto";
import { checkHealth } from "@/server/services/healthService";

// Public health check for Render health checks, uptime monitors and the keep-alive workflow.
// 200 = app and database up; 503 = app up but database unreachable.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(): Promise<Response> {
  const report = await checkHealth();
  return Response.json(
    { data: report, requestId: randomUUID() },
    { status: report.status === "ok" ? 200 : 503, headers: NO_STORE },
  );
}

// Cheap liveness probe: no database round trip.
export function HEAD(): Response {
  return new Response(null, { status: 200, headers: NO_STORE });
}
