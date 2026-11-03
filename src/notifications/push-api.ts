import "server-only";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callRpc } from "@/data/rpc";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AI_HOME } from "@/features/auth/routing";
import { pushSubscriptionSchema } from "./subscription";

const subscribeSchema = z.object({
  subscription: pushSubscriptionSchema.nullable(),
  appVersion: z.string().trim().min(1).max(40),
});

const openedSchema = z.object({ notificationId: z.uuid() });

const SIGN_IN = "Sign in to continue.";
const INVALID = "Check the details and try again.";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function isSignedIn(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function statusFor(reason: string | undefined): number {
  if (reason === "UNAUTHENTICATED" || reason === "NOT_SIGNED_IN") return 401;
  if (reason === "INVALID_INPUT") return 400;
  if (reason === "NOT_FOUND") return 404;
  return 500;
}

/**
 * POST /api/push/subscribe {subscription, appVersion}: saves this browser's push subscription for the
 * signed-in person (rs_device_register), or records the device with push off when it is null.
 */
export async function handleSubscribe(request: Request): Promise<NextResponse> {
  if (!(await isSignedIn())) return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 });

  const result = await callRpc<string>("rs_device_register", {
    p_platform: "web",
    p_subscription: parsed.data.subscription,
    p_app_version: parsed.data.appVersion,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.reason) });
  revalidatePath(AI_HOME, "layout");
  return NextResponse.json({ ok: true, deviceId: result.data, push: parsed.data.subscription !== null });
}

/** POST /api/push/opened {notificationId}: the service worker reports a tapped push. */
export async function handleOpened(request: Request): Promise<NextResponse> {
  if (!(await isSignedIn())) return NextResponse.json({ error: SIGN_IN }, { status: 401 });
  const parsed = openedSchema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: INVALID }, { status: 400 });

  const result = await callRpc("rs_notification_opened", { p_id: parsed.data.notificationId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: statusFor(result.reason) });
  revalidatePath(AI_HOME, "layout");
  return NextResponse.json({ ok: true });
}
