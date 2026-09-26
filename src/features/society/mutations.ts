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
import { accountService } from "@/server/services/accountService";
import { unitImportService } from "@/server/services/unitImportService";

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
  _: FormState<{ inviteUrl: string; email: string; emailed: boolean }>,
  fd: FormData,
): Promise<FormState<{ inviteUrl: string; email: string; emailed: boolean }>> {
  const r = await runAction("member.invite", async () => {
    const ctx = await requireSocietyContext(slug);
    return societyService.inviteMember(ctx, formToObject(fd));
  });
  if (r.ok) revalidatePath(`/s/${slug}/members`);
  return r;
}

export async function forgotPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  return runAction("auth.forgot", async () => {
    await limitAuth("forgot", String(fd.get("email") ?? ""));
    await accountService.requestPasswordReset(formToObject(fd));
    return null;
  });
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction("auth.reset", async () => {
    await limitAuth("reset", String(fd.get("token") ?? ""));
    const { userId } = await accountService.resetPassword(formToObject(fd));
    await createSession(userId);
    return null;
  });
  if (r.ok) redirect("/societies?reset=1");
  return r;
}

export async function verifyEmailAction(_: FormState<{ verified: boolean }>, fd: FormData): Promise<FormState<{ verified: boolean }>> {
  return runAction("auth.verify", async () => {
    const { ok } = await accountService.verifyEmail(formToObject(fd));
    if (!ok) throw new AppError("NOT_FOUND", "This link is invalid, expired or already used. Sign in and ask for a new one.");
    return { verified: true };
  });
}

export async function resendVerificationAction(): Promise<FormState> {
  return runAction("auth.resend_verification", async () => {
    const user = await requireUser();
    await limitAuth("resend", user.email);
    if (!user.emailVerified) await accountService.sendVerification(user);
    return null;
  });
}

export async function signOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await accountService.signOutEverywhere(user.id);
  await destroySession();
  redirect("/login?signedOut=all");
}

export type UnitImportPreview = Awaited<ReturnType<typeof unitImportService.preview>>;

export async function previewUnitImportAction(slug: string, csv: string): Promise<FormState<UnitImportPreview>> {
  return runAction("unit.import_preview", async () => {
    const ctx = await requireSocietyContext(slug);
    return unitImportService.preview(ctx, { csv });
  });
}

export async function commitUnitImportAction(slug: string, csv: string): Promise<FormState<{ imported: number; skipped: number }>> {
  const r = await runAction("unit.import", async () => {
    const ctx = await requireSocietyContext(slug);
    return unitImportService.commit(ctx, { csv });
  });
  if (r.ok) revalidatePath(`/s/${slug}/setup`);
  return r;
}
