import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, type ErrorCode } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";

export type ActionResult<T> =
  | { ok: true; data: T; requestId: string }
  | {
      ok: false;
      error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };
      requestId: string;
    };

/** Wraps a server action: maps known errors to typed results, logs unknown ones, never leaks stacks. */
export async function runAction<T>(name: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  const requestId = randomUUID();
  try {
    return { ok: true, data: await fn(), requestId };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors }, requestId };
    }
    if (err instanceof z.ZodError) {
      const fieldErrors = z.flattenError(err).fieldErrors as Record<string, string[]>;
      return { ok: false, error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors }, requestId };
    }
    logger.error("action failed", {
      action: name,
      requestId,
      errorType: err instanceof Error ? err.name : typeof err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { ok: false, error: { code: "INTERNAL", message: "Something went wrong. Please try again." }, requestId };
  }
}
