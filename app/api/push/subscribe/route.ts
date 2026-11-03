import { handleSubscribe } from "@/notifications/push-api";

export const dynamic = "force-dynamic";

/** Saves this browser's web push subscription for the signed-in person, or turns push off. */
export function POST(request: Request) {
  return handleSubscribe(request);
}
