/**
 * Why a card could not be rendered or acted on. The agent gets the reason and message back from
 * render_card; nothing is shown to the owner.
 */
export type CardErrorReason =
  | "SETUP"
  | "INVALID_INPUT"
  | "INVALID_CARD"
  | "NOT_FOUND"
  | "ACTION_UNAVAILABLE"
  | "DB";

export class CardError extends Error {
  readonly reason: CardErrorReason;

  constructor(reason: CardErrorReason, message: string) {
    super(message);
    this.name = "CardError";
    this.reason = reason;
  }
}

export const MISSING_SECRET_KEY =
  "Cards cannot be saved: SUPABASE_SECRET_KEY is not set on the server. Add it to .env.local and restart.";
