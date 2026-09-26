import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { audit } from "@/lib/audit";
import { hasPermission, loadSocietyContext, type SocietyContext } from "@/lib/auth/context";
import type { SessionUser } from "@/lib/auth/session";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { fileStorage } from "@/lib/storage";
import { cleanFileName, MAX_PHOTO_BYTES, MAX_PHOTOS_PER_COMPLAINT, sniffImage } from "@/lib/storage/images";
import { complaintService } from "./complaintService";

const addPhotoSchema = z.object({ complaintId: z.uuid() });

export interface UploadedFile {
  name: string;
  bytes: Uint8Array;
}

export const attachmentService = {
  /**
   * Adds one photo to a complaint. Who: the resident who raised it, the assignee, or managers.
   * Type is sniffed from bytes; blob is written first and removed again if the DB write fails.
   */
  async addComplaintPhoto(ctx: SocietyContext, raw: unknown, file: UploadedFile) {
    const { complaintId } = addPhotoSchema.parse(raw);
    const c = await complaintService.get(ctx, complaintId); // visibility + tenant check
    const isRaiser = ctx.memberIds.includes(c.raisedById);
    const isAssignee = !!c.assigneeId && ctx.memberIds.includes(c.assigneeId);
    if (!isRaiser && !isAssignee && !hasPermission(ctx, "complaint.assign")) throw forbidden();
    if (c.status === "CLOSED" || c.status === "CANCELLED") throw conflict("Photos can't be added to a closed complaint.");

    if (file.bytes.length === 0) throw new AppError("VALIDATION", "That file is empty.", { photo: ["That file is empty."] });
    if (file.bytes.length > MAX_PHOTO_BYTES) {
      throw new AppError("VALIDATION", "Photo is larger than 4 MB.", { photo: ["Photo is larger than 4 MB."] });
    }
    const type = sniffImage(file.bytes);
    if (!type) throw new AppError("VALIDATION", "Only JPG, PNG or WebP photos can be added.", { photo: ["Only JPG, PNG or WebP photos."] });
    const count = await db.complaintAttachment.count({ where: { complaintId } });
    if (count >= MAX_PHOTOS_PER_COMPLAINT) throw conflict(`A complaint can have up to ${MAX_PHOTOS_PER_COMPLAINT} photos.`);

    const key = `${ctx.societyId}/complaints/${complaintId}/${randomUUID()}.${type.ext}`;
    const storage = fileStorage();
    await storage.put(key, file.bytes, type.mime);
    try {
      return await db.$transaction(async (tx) => {
        const asset = await tx.fileAsset.create({
          data: {
            societyId: ctx.societyId,
            uploadedById: ctx.user.id,
            purpose: "COMPLAINT_PHOTO",
            storageKey: key,
            mimeType: type.mime,
            sizeBytes: file.bytes.length,
            originalName: cleanFileName(file.name),
          },
        });
        await tx.complaintAttachment.create({ data: { complaintId, fileId: asset.id } });
        await tx.complaintActivity.create({ data: { complaintId, actorId: ctx.user.id, type: "COMMENT", note: "Added a photo" } });
        await audit.log(tx, {
          societyId: ctx.societyId,
          actorId: ctx.user.id,
          action: "complaint.photo_added",
          entityType: "Complaint",
          entityId: complaintId,
          after: { fileId: asset.id, sizeBytes: asset.sizeBytes },
        });
        return asset;
      });
    } catch (e) {
      await storage.delete(key).catch((err: unknown) => logger.error("orphan blob cleanup failed", { key, error: String(err) }));
      throw e;
    }
  },

  /**
   * Resolve a file for download. Every failure is a plain NOT_FOUND so file ids can't be probed.
   */
  async openFile(user: SessionUser, fileId: string): Promise<{ bytes: Uint8Array; mimeType: string; name: string }> {
    if (!z.uuid().safeParse(fileId).success) throw notFound("File");
    const asset = await db.fileAsset.findUnique({
      where: { id: fileId },
      include: { society: { select: { slug: true } }, attachment: { select: { complaintId: true } } },
    });
    if (!asset?.attachment) throw notFound("File");
    let ctx: SocietyContext;
    try {
      ctx = await loadSocietyContext(user, asset.society.slug);
      await complaintService.get(ctx, asset.attachment.complaintId);
    } catch {
      throw notFound("File");
    }
    const bytes = await fileStorage().get(asset.storageKey);
    if (!bytes) throw notFound("File");
    return { bytes, mimeType: asset.mimeType, name: asset.originalName };
  },
};
