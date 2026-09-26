import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "dwellops_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  sessionId: string;
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Current user from session cookie, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  const { emailVerifiedAt, ...u } = session.user;
  return { ...u, emailVerified: !!emailVerifiedAt, sessionId: session.id };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

/** For pages: redirect to login instead of throwing. */
export async function requireUserOrRedirect(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
  (await cookies()).delete(SESSION_COOKIE);
}
