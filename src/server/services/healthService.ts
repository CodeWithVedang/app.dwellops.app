import "server-only";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export type HealthStatus = "ok" | "degraded";

export interface HealthReport {
  status: HealthStatus;
  database: { ok: boolean; latencyMs: number };
  version: string;
  uptimeSeconds: number;
  time: string;
}

const DB_TIMEOUT_MS = 3000;

export async function pingDatabase(query: () => Promise<unknown>, timeoutMs = DB_TIMEOUT_MS): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      query(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Database ping timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    logger.error("health.database_unreachable", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

/** Liveness + database reachability. Exposes no tenant data, config or secrets. */
export async function checkHealth(): Promise<HealthReport> {
  const database = await pingDatabase(() => db.$queryRaw`SELECT 1`);
  return {
    status: database.ok ? "ok" : "degraded",
    database,
    version: process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.RENDER_GIT_COMMIT?.slice(0, 12) ?? "dev",
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  };
}
