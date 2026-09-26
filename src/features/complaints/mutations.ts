"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { requireSocietyContext } from "@/lib/auth/context";
import { complaintService } from "@/server/services/complaintService";
import { attachmentService } from "@/server/services/attachmentService";
import { AppError } from "@/lib/errors";
import type { FormState } from "@/features/society/mutations";

export async function createComplaintAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const r = await runAction("complaint.create", async () => {
    const ctx = await requireSocietyContext(slug);
    id = (await complaintService.create(ctx, formToObject(fd))).id;
    return null;
  });
  if (r.ok) redirect(`/s/${slug}/complaints/${id}?created=1`);
  return r;
}

type Op = "assign" | "status" | "resolve" | "decision" | "comment";

/** Single entry for detail-page operations; each op is authorized inside the service. */
export async function complaintOpAction(slug: string, op: Op, _: FormState, fd: FormData): Promise<FormState> {
  const input = formToObject(fd);
  const r = await runAction(`complaint.${op}`, async () => {
    const ctx = await requireSocietyContext(slug);
    switch (op) {
      case "assign":
        await complaintService.assign(ctx, input);
        break;
      case "status":
        await complaintService.updateStatus(ctx, input);
        break;
      case "resolve":
        await complaintService.resolve(ctx, input);
        break;
      case "decision":
        await complaintService.residentDecision(ctx, input);
        break;
      case "comment":
        await complaintService.comment(ctx, input);
        break;
    }
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}/complaints/${input.complaintId ?? ""}`);
  return r;
}

/** One photo per call (client compresses first) so each request stays well under host body limits. */
export async function uploadComplaintPhotoAction(slug: string, fd: FormData): Promise<FormState> {
  const complaintId = String(fd.get("complaintId") ?? "");
  const r = await runAction("complaint.photo", async () => {
    const ctx = await requireSocietyContext(slug);
    const photo = fd.get("photo");
    if (!(photo instanceof File)) throw new AppError("VALIDATION", "Choose a photo.", { photo: ["Choose a photo."] });
    await attachmentService.addComplaintPhoto(ctx, { complaintId }, { name: photo.name, bytes: new Uint8Array(await photo.arrayBuffer()) });
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}/complaints/${complaintId}`);
  return r;
}
