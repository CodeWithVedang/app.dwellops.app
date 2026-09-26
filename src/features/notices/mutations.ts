"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { requireSocietyContext } from "@/lib/auth/context";
import { noticeService } from "@/server/services/noticeService";
import type { FormState } from "@/features/society/mutations";

export async function createNoticeAction(slug: string, _: FormState, fd: FormData): Promise<FormState> {
  let id = "";
  const r = await runAction("notice.create", async () => {
    const ctx = await requireSocietyContext(slug);
    id = (await noticeService.create(ctx, formToObject(fd))).id;
    return null;
  });
  if (r.ok) redirect(`/s/${slug}/notices/${id}?saved=1`);
  return r;
}

type Op = "publish" | "archive" | "acknowledge";

export async function noticeOpAction(slug: string, op: Op, _: FormState, fd: FormData): Promise<FormState> {
  const input = formToObject(fd);
  const r = await runAction(`notice.${op}`, async () => {
    const ctx = await requireSocietyContext(slug);
    if (op === "publish") await noticeService.publish(ctx, input);
    if (op === "archive") await noticeService.archive(ctx, input);
    if (op === "acknowledge") await noticeService.acknowledge(ctx, input);
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}`, "layout");
  return r;
}
