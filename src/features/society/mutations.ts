"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { createSession, destroySession, requireUser } from "@/lib/auth/session";
import { requireSocietyContext } from "@/lib/auth/context";
import { rateLimit } from "@/lib/auth/rate-limit";
import { AppError } from "@/lib/errors";
import { headers } from "next/headers";
import { authService } from "@/server/services/authService";
import { societyService } from "@/server/services/societyService";

export type FormState<T = null> = ActionResult<T> | null;

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Per IP + subject (email or invite token), so neighbours on one Wi-Fi/NAT don't lock each other out. */
async function limitAuth(scope: string, subject = ""): Promise<void> {
  if (!rateLimit(`${scope}:${await clientKey()}:${subject.trim().toLowerCase()}`, 10, 15 * 60 * 1000)) {
    throw new AppError("RATE_LIMITED", "Too many attempts. Wait a few minutes and try again.");
  }
}

export async function signUpAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction("auth.signup", async () => {
    await limitAuth("signup");
    const { userId } = await authService.signUp(formToObject(fd));
    await createSession(userId);
    return null;
  });
  if (r.ok) redirect("/societies");
  return r;
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction("auth.login", async () => {
    await limitAuth("login", String(fd.get("email") ?? ""));
    const { userId } = await authService.login(formToObject(fd));
    await createSession(userId);
    return null;
  });
  if (r.ok) redirect("/societies");
  return r;
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  let slug = "";
  const r = await runAction("invite.accept", async () => {
    await limitAuth("invite", String(fd.get("token") ?? ""));
    const res = await authService.acceptInvite(formToObject(fd));
    await createSession(res.userId);
    slug = res.societySlug;
    return null;
  });
  if (r.ok) redirect(`/s/${slug}`);
  return r;
}

export async function createSocietyAction(_: FormState, fd: FormData): Promise<FormState> {
  let slug = "";
  const r = await runAction("society.create", async () => {
    const user = await requireUser();
    slug = (await societyService.createSociety(user, formToObject(fd))).slug;
    return null;
  });
  if (r.ok) redirect(`/s/${slug}/setup`);
  return r;
}

export async function createBuildingAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction("building.create", async () => {
    const ctx = await requireSocietyContext(slug);
    await societyService.createBuilding(ctx, formToObject(fd));
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}/setup`);
  return r;
}

export async function createUnitAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction("unit.create", async () => {
    const ctx = await requireSocietyContext(slug);
    await societyService.createUnit(ctx, formToObject(fd));
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}/setup`);
  return r;
}

export async function inviteMemberAction(
  slug: string,
  _: FormState<{ inviteUrl: string; email: string }>,
  fd: FormData,
): Promise<FormState<{ inviteUrl: string; email: string }>> {
  const r = await runAction("member.invite", async () => {
    const ctx = await requireSocietyContext(slug);
    return societyService.inviteMember(ctx, formToObject(fd));
  });
  if (r.ok) revalidatePath(`/s/${slug}/members`);
  return r;
}
