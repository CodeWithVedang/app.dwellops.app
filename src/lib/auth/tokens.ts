import { createHash, randomBytes } from "node:crypto";

/** Opaque random token for cookies/invite links. Only its hash is persisted. */
export const generateToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
