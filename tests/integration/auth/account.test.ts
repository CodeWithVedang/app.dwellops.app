import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "../../support/db";
import { authService } from "@/server/services/authService";
import { accountService } from "@/server/services/accountService";
import { emailProvider, MemoryEmailProvider } from "@/lib/email";
import { verifyPassword } from "@/lib/auth/password";

const outbox = () => (emailProvider() as MemoryEmailProvider).outbox;
const lastLink = (kind: "verify-email" | "reset-password") => {
  const m = outbox().at(-1)?.text.match(new RegExp(`/${kind}/([A-Za-z0-9_-]+)`));
  if (!m?.[1]) throw new Error(`no ${kind} link in outbox`);
  return m[1];
};

describe("email verification and password reset", () => {
  let userId = "";
  const email = "priya@example.test";

  beforeAll(async () => {
    await resetDb();
    outbox().length = 0;
    userId = (await authService.signUp({ name: "Priya Shah", email, password: "original-pass-1" })).userId;
  });

  beforeEach(() => {
    expect(emailProvider()).toBeInstanceOf(MemoryEmailProvider);
  });

  it("signup sends a verification link that verifies once", async () => {
    expect(outbox().at(-1)?.to).toBe(email);
    const token = lastLink("verify-email");
    expect(await accountService.verifyEmail({ token })).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).emailVerifiedAt).not.toBeNull();
    expect(await accountService.verifyEmail({ token })).toEqual({ ok: false });
  });

  it("does not reveal whether an email has an account", async () => {
    const before = outbox().length;
    await expect(accountService.requestPasswordReset({ email: "nobody@example.test" })).resolves.toBeUndefined();
    expect(outbox().length).toBe(before);
  });

  it("resets the password, burns the token and signs out every session", async () => {
    await db.session.createMany({
      data: [
        { userId, tokenHash: "h1-" + Date.now(), expiresAt: new Date(Date.now() + 3600_000) },
        { userId, tokenHash: "h2-" + Date.now(), expiresAt: new Date(Date.now() + 3600_000) },
      ],
    });
    await accountService.requestPasswordReset({ email });
    const token = lastLink("reset-password");
    expect(await accountService.isResetTokenValid(token)).toBe(true);

    await expect(accountService.resetPassword({ token, password: "brand-new-pass-2", confirm: "different-pass" })).rejects.toThrow();
    await accountService.resetPassword({ token, password: "brand-new-pass-2", confirm: "brand-new-pass-2" });

    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(u.passwordHash!, "brand-new-pass-2")).toBe(true);
    expect(await db.session.count({ where: { userId } })).toBe(0);
    await expect(accountService.resetPassword({ token, password: "third-pass-333", confirm: "third-pass-333" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a newer reset link cancels the older one", async () => {
    await accountService.requestPasswordReset({ email });
    const first = lastLink("reset-password");
    await accountService.requestPasswordReset({ email });
    const second = lastLink("reset-password");
    expect(await accountService.isResetTokenValid(first)).toBe(false);
    expect(await accountService.isResetTokenValid(second)).toBe(true);
  });

  it("expired reset links are rejected", async () => {
    await accountService.requestPasswordReset({ email });
    const token = lastLink("reset-password");
    await db.emailToken.updateMany({ where: { userId, purpose: "RESET_PASSWORD", usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await accountService.isResetTokenValid(token)).toBe(false);
    await expect(accountService.resetPassword({ token, password: "late-pass-1234", confirm: "late-pass-1234" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("verify tokens cannot be used as reset tokens", async () => {
    await accountService.sendVerification({ id: userId, email, name: "Priya Shah" });
    const token = lastLink("verify-email");
    expect(await accountService.isResetTokenValid(token)).toBe(false);
  });
});
