"use server";

import { revalidatePath } from "next/cache";
import { callRpc } from "@/data/rpc";

export async function markAllNotificationsReadAction(): Promise<void> {
  await callRpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/", "layout");
}
