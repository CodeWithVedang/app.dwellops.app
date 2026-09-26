"use server";

import { revalidatePath } from "next/cache";
import { requireSocietyContext } from "@/lib/auth/context";
import { activityService } from "@/server/services/activityService";

export async function markAllReadAction(slug: string): Promise<void> {
  const ctx = await requireSocietyContext(slug);
  await activityService.markAllRead(ctx);
  revalidatePath(`/s/${slug}`, "layout");
}
