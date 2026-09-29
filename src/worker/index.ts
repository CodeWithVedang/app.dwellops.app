// Nivaso Plus backend worker (Render web service).
// Runs scheduled jobs and exposes /health. The Next.js app on Vercel serves all user traffic.
// Start: npm run worker:start  (needs DATABASE_URL and AUTH_SECRET, same as the app)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { checkHealth } from "@/server/services/healthService";
import { runOverdueComplaintAlerts } from "@/server/jobs/overdueComplaints";

const PORT = Number(process.env.PORT ?? 10000);
const JOB_INTERVAL_MS = 15 * 60 * 1000;
// Render free instances sleep after 15 min without inbound traffic. A request to our own public
// URL goes through Render's proxy, so it counts as traffic and keeps the jobs running.
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000;

interface Job {
  name: string;
  run: () => Promise<unknown>;
  running: boolean;
  lastRunAt: string | null;
  lastOk: boolean | null;
}

const jobs: Job[] = [
  { name: "overdue-complaints", run: () => runOverdueComplaintAlerts(), running: false, lastRunAt: null, lastOk: null },
];

async function runJob(job: Job): Promise<void> {
  if (job.running) return; // previous run still busy; skip instead of overlapping
  job.running = true;
  const started = Date.now();
  try {
    const result = await job.run();
    job.lastOk = true;
    logger.info("worker.job_done", { job: job.name, ms: Date.now() - started, result });
  } catch (err) {
    job.lastOk = false;
    logger.error("worker.job_failed", { job: job.name, error: err instanceof Error ? err.message : String(err) });
  } finally {
    job.running = false;
    job.lastRunAt = new Date().toISOString();
  }
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? "/", "http://worker").pathname;
  if (path !== "/health" && path !== "/") {
    send(res, 404, { error: { code: "NOT_FOUND", message: "Not found" }, requestId: randomUUID() });
    return;
  }
  if (req.method === "HEAD") {
    send(res, 200);
    return;
  }
  if (req.method !== "GET") {
    send(res, 405, { error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or HEAD" }, requestId: randomUUID() });
    return;
  }
  const report = await checkHealth();
  const jobStatus = jobs.map(({ name, lastRunAt, lastOk }) => ({ name, lastRunAt, lastOk }));
  send(res, report.status === "ok" ? 200 : 503, { data: { ...report, service: "worker", jobs: jobStatus }, requestId: randomUUID() });
}

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    logger.error("worker.request_failed", { error: err instanceof Error ? err.message : String(err) });
    if (!res.headersSent) send(res, 500, { error: { code: "INTERNAL", message: "Internal error" }, requestId: randomUUID() });
  });
});

const timers: ReturnType<typeof setInterval>[] = [];

server.listen(PORT, () => {
  logger.info("worker.started", { port: PORT });
  for (const job of jobs) {
    void runJob(job);
    timers.push(setInterval(() => void runJob(job), JOB_INTERVAL_MS));
  }
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    timers.push(
      setInterval(() => {
        fetch(`${selfUrl}/health`, { method: "HEAD", signal: AbortSignal.timeout(30_000) }).catch((err: unknown) =>
          logger.warn("worker.self_ping_failed", { error: err instanceof Error ? err.message : String(err) }),
        );
      }, SELF_PING_INTERVAL_MS),
    );
  }
});

function shutdown(signal: string): void {
  logger.info("worker.stopping", { signal });
  timers.forEach(clearInterval);
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
