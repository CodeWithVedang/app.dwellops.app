import "server-only";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { AppError, conflict } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { acceptInviteSchema, loginSchema, signUpSchema } from "@/features/society/schemas";

// Real hash of a random value: unknown emails cost the same verify time as wrong passwords.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(crypto.randomUUID()));

export const authService = {
  async signUp(raw: unknown): Promise<{ userId: string }> {
    const input = signUpSchema.parse(raw);
    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict("An account with this email already exists. Sign in instead.");
    const user = await db.user.create({
      data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password) },
    });
    await audit.log(db, { societyId: null, actorId: user.id, action: "user.signup", entityType: "User", entityId: user.id });
    return { userId: user.id };
  },

  async login(raw: unknown): Promise<{ userId: string }> {
    const input = loginSchema.parse(raw);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), input.password);
    if (!user || !user.passwordHash || !ok) {
      throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.");
    }
    await audit.log(db, { societyId: null, actorId: user.id, action: "user.login", entityType: "User", entityId: user.id });
    return { userId: user.id };
  },

  /** Look up a pending invite by raw token (for the accept page). */
  async findInvite(token: string) {
    const invite = await db.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { society: { select: { name: true, slug: true } }, unit: { select: { unitNumber: true } } },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
    const hasAccount = !!(await db.user.findUnique({ where: { email: invite.email }, select: { passwordHash: true } }))?.passwordHash;
    return { ...invite, hasAccount };
  },

  /**
   * Accept invite: create or reuse the user, add membership + unit link, mark accepted — all in one transaction.
   * Existing accounts must confirm with their current password.
   */
  async acceptInvite(raw: unknown): Promise<{ userId: string; societySlug: string }> {
    const input = acceptInviteSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const invite = await tx.invitation.findUnique({
        where: { tokenHash: hashToken(input.token) },
        include: { society: { select: { slug: true } } },
      });
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new AppError("NOT_FOUND", "This invite link is invalid or has expired. Ask your society office for a new one.");
      }
      let user = await tx.user.findUnique({ where: { email: invite.email } });
      if (user?.passwordHash) {
        if (!(await verifyPassword(user.passwordHash, input.password))) {
          throw new AppError("VALIDATION", "Password is incorrect.", { password: ["Enter your existing DwellOps password."] });
        }
      } else if (user) {
        user = await tx.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() } });
      } else {
        user = await tx.user.create({
          // Invite link was delivered to this email, so possession verifies it.
          data: { email: invite.email, name: invite.name, passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() },
        });
      }
      const member = await tx.societyMember.upsert({
        where: { societyId_userId_role: { societyId: invite.societyId, userId: user.id, role: invite.role } },
        create: { societyId: invite.societyId, userId: user.id, role: invite.role, status: "ACTIVE" },
        update: { status: "ACTIVE" },
      });
      if (invite.unitId) {
        await tx.unitMember.upsert({
          where: { unitId_memberId: { unitId: invite.unitId, memberId: member.id } },
          create: { unitId: invite.unitId, memberId: member.id, relation: invite.relation ?? (invite.role === "TENANT" ? "TENANT" : "OWNER") },
          update: {},
        });
      }
      const consumed = await tx.invitation.updateMany({ where: { id: invite.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
      if (consumed.count !== 1) throw conflict("This invite was already used.");
      await audit.log(tx, {
        societyId: invite.societyId,
        actorId: user.id,
        action: "member.joined",
        entityType: "SocietyMember",
        entityId: member.id,
        after: { role: invite.role, unitId: invite.unitId },
      });
      return { userId: user.id, societySlug: invite.society.slug };
    });
  },
};
