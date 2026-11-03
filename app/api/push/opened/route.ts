import { handleOpened } from "@/notifications/push-api";

export const dynamic = "force-dynamic";

/** Records that the signed-in person opened a push, so it does not count as ignored. */
export function POST(request: Request) {
  return handleOpened(request);
}
