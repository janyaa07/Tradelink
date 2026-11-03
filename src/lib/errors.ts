/**
 * Database functions raise "TLnnn:REASON:detail" (docs/RPC_CONTRACT.md).
 * This module turns them into the plain copy the prototype uses.
 */
export type AppError = { code: string; reason: string; detail: string; message: string };

const MESSAGES: Record<string, string> = {
  NOT_SIGNED_IN: "Sign in to continue.",
  NOT_ALLOWED: "You do not have access to do that.",
  NOT_FOUND: "This record is not available.",
  INVALID_TRANSITION: "You do not have access to do that.",
  STOCK_SHORT: "Check the highlighted lines before placing this order.",
  DUPLICATE: "This already exists. Choose it from the list.",
  STALE_DRAFT: "This order changed in another tab. Check it again before confirming.",
  CONFIRM_STOCK_FIRST: "Confirm stock for the new products in this order first.",
  ALREADY_REPORTED: "You have already reported this order as late.",
  BELOW_RESERVED: "This leaves less stock than is reserved for open orders.",
  RATE_LIMITED: "Too many requests. Try again in a few minutes.",
  INVALID_INPUT: "Check the details and try again.",
  STALE_VERSION: "That was an older version. Here's the latest.",
  NOT_READY: "Every line needs an item you chose and a quantity.",
  UNDO_EXPIRED: "This can no longer be undone.",
  FORBIDDEN: "You do not have access to do that.",
  UNAUTHENTICATED: "Sign in to continue.",
};

const FALLBACK = "Something went wrong. Try again.";

export function parseDbError(raw: string | undefined | null): AppError {
  const match = /(TL\d{3}):([A-Z_]+):?(.*)/s.exec(raw ?? "");
  if (!match) return { code: "TL500", reason: "UNEXPECTED", detail: "", message: FALLBACK };
  const [, code = "TL500", reason = "UNEXPECTED", detail = ""] = match;
  return { code, reason, detail: detail.trim(), message: MESSAGES[reason] ?? FALLBACK };
}

/** The copy for a reason code, for errors raised outside the database. */
export function messageFor(reason: string): string {
  return MESSAGES[reason] ?? FALLBACK;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; reason?: string; detail?: string };
