import "server-only";
import type { SocietyRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db/client";
import { forbidden } from "@/lib/errors";
import { can, type Permission } from "@/lib/permissions";
import { requireUser, type SessionUser } from "./session";

/** Verified tenant context: authenticated user + active memberships in one society. */
export interface SocietyContext {
  user: SessionUser;
  societyId: string;
  societySlug: string;
  societyName: string;
  roles: SocietyRole[];
  /** Membership ids of the user in this society (a user may hold several roles). */
  memberIds: string[];
}

export async function loadSocietyContext(user: SessionUser, slug: string): Promise<SocietyContext> {
  const society = await db.society.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      members: { where: { userId: user.id, status: "ACTIVE" }, select: { id: true, role: true } },
    },
  });
  // Same error for unknown society and non-member: prevents slug enumeration.
  if (!society || society.members.length === 0) throw forbidden();
  return {
    user,
    societyId: society.id,
    societySlug: society.slug,
    societyName: society.name,
    roles: society.members.map((m) => m.role),
    memberIds: society.members.map((m) => m.id),
  };
}

export async function requireSocietyContext(slug: string): Promise<SocietyContext> {
  return loadSocietyContext(await requireUser(), slug);
}

export function authorize(ctx: SocietyContext, permission: Permission): void {
  if (!can(ctx.roles, permission)) throw forbidden();
}

export const hasPermission = (ctx: SocietyContext, permission: Permission): boolean => can(ctx.roles, permission);
