import "server-only";
import type { EmailTokenPurpose } from "@/generated/prisma/enums";
import { db, type DbOrTx } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { AppError } from "@/lib/errors";
import { actionEmail, sendEmail } from "@/lib/email";
import { emailTokenSchema, forgotPasswordSchema, resetPasswordSchema } from "@/features/society/schemas";

const TTL_MS: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Issue a fresh single-use token; earlier unused tokens of the same purpose stop working. */
async function issueToken(client: DbOrTx, userId: string, purpose: EmailTokenPurpose): Promise<string> {
  const now = new Date();
  await client.emailToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
  const token = generateToken();
  await client.emailToken.create({
    data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TTL_MS[purpose]) },
  });
  return token;
}

async function findValid(token: string, purpose: EmailTokenPurpose) {
  const row = await db.emailToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, emailVerifiedAt: true } } },
  });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

export const accountService = {
  async sendVerification(user: { id: string; email: string; name: string }): Promise<void> {
    const token = await issueToken(db, user.id, "VERIFY_EMAIL");
    await sendEmail(
      actionEmail({
        to: user.email,
        subject: "Confirm your email for DwellOps",
        heading: `Hi ${user.name.split(" ")[0]}, confirm your email`,
        intro: "Confirming your email lets us send you password resets and important society updates.",
        cta: "Confirm email",
        url: `${appUrl()}/verify-email/${token}`,
        footer: "This link works for 24 hours. If you didn't create a DwellOps account, ignore this email.",
      }),
    );
  },

  async verifyEmail(raw: unknown): Promise<{ ok: boolean }> {
    const { token } = emailTokenSchema.parse(raw);
    const row = await findValid(token, "VERIFY_EMAIL");
    if (!row) return { ok: false };
    await db.$transaction(async (tx) => {
      const used = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count !== 1) throw new AppError("NOT_FOUND", "This link was already used.");
      await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() } });
      await audit.log(tx, { societyId: null, actorId: row.userId, action: "user.email_verified", entityType: "User", entityId: row.userId });
    });
    return { ok: true };
  },

  /**
   * Always resolves the same way whether or not the email exists, so the form can't be used
   * to discover who has an account.
   */
  async requestPasswordReset(raw: unknown): Promise<void> {
    const { email } = forgotPasswordSchema.parse(raw);
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, passwordHash: true } });
    if (!user?.passwordHash) return;
    const token = await issueToken(db, user.id, "RESET_PASSWORD");
    await audit.log(db, { societyId: null, actorId: user.id, action: "user.password_reset_requested", entityType: "User", entityId: user.id });
    await sendEmail(
      actionEmail({
        to: user.email,
        subject: "Reset your DwellOps password",
        heading: "Reset your password",
        intro: "Someone (hopefully you) asked to reset the password for this email. Choose a new one using the button below.",
        cta: "Choose a new password",
        url: `${appUrl()}/reset-password/${token}`,
        footer: "This link works for 1 hour and only once. If you didn't ask for this, you can ignore it — your password stays the same.",
      }),
    );
  },

  async isResetTokenValid(token: string): Promise<boolean> {
    return !!(await findValid(token, "RESET_PASSWORD"));
  },

  /** Sets the new password, burns the token and signs the user out everywhere. */
  async resetPassword(raw: unknown): Promise<{ userId: string }> {
    const input = resetPasswordSchema.parse(raw);
    const row = await findValid(input.token, "RESET_PASSWORD");
    if (!row) throw new AppError("NOT_FOUND", "This reset link is invalid or has expired. Ask for a new one.");
    const passwordHash = await hashPassword(input.password);
    await db.$transaction(async (tx) => {
      const used = await tx.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count !== 1) throw new AppError("NOT_FOUND", "This reset link was already used.");
      // Proving control of the inbox also verifies the email.
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerifiedAt: row.user.emailVerifiedAt ?? new Date() } });
      await tx.session.deleteMany({ where: { userId: row.userId } });
      await audit.log(tx, { societyId: null, actorId: row.userId, action: "user.password_reset", entityType: "User", entityId: row.userId });
    });
    return { userId: row.userId };
  },

  async signOutEverywhere(userId: string): Promise<number> {
    const r = await db.session.deleteMany({ where: { userId } });
    await audit.log(db, { societyId: null, actorId: userId, action: "user.signed_out_everywhere", entityType: "User", entityId: userId, after: { sessions: r.count } });
    return r.count;
  },
};
