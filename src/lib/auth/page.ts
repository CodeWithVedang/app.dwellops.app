import "server-only";
import { notFound } from "next/navigation";
import { hasPermission, loadSocietyContext, type SocietyContext } from "./context";
import { requireUserOrRedirect } from "./session";
import { AppError } from "@/lib/errors";
import type { Permission } from "@/lib/permissions";

/** Page-level guard: unauthorized users get a 404 (no hint the page exists). Services still enforce their own checks. */
export function authorizePage(ctx: SocietyContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) notFound();
}

/**
 * Page-level tenant context. Non-members get a 404 instead of an unhandled error
 * (pages render in parallel with the layout, which does the same check).
 */
export async function requirePageContext(slug: string): Promise<SocietyContext> {
  const user = await requireUserOrRedirect();
  try {
    return await loadSocietyContext(user, slug);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
}
