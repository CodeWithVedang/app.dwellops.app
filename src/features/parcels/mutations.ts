"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/result";
import { formToObject } from "@/lib/actions/form";
import { requireSocietyContext } from "@/lib/auth/context";
import { parcelService } from "@/server/services/parcelService";
import type { FormState } from "@/features/society/mutations";

export async function logParcelAction(
  slug: string,
  _: FormState<{ number: number; notified: number; unit: string }>,
  fd: FormData,
): Promise<FormState<{ number: number; notified: number; unit: string }>> {
  const r = await runAction("parcel.log", async () => {
    const ctx = await requireSocietyContext(slug);
    const p = await parcelService.log(ctx, formToObject(fd));
    return { number: p.number, notified: p.notified, unit: p.unitLabel };
  });
  if (r.ok) revalidatePath(`/s/${slug}`, "layout");
  return r;
}

export async function parcelOpAction(slug: string, op: "handover" | "return", _: FormState, fd: FormData): Promise<FormState> {
  const r = await runAction(`parcel.${op}`, async () => {
    const ctx = await requireSocietyContext(slug);
    if (op === "handover") await parcelService.handover(ctx, formToObject(fd));
    else await parcelService.markReturned(ctx, formToObject(fd));
    return null;
  });
  if (r.ok) revalidatePath(`/s/${slug}`, "layout");
  return r;
}
