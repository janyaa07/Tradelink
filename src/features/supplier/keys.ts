import "server-only";

/**
 * A new idempotency key for one rendered form (RPC_CONTRACT, Idempotency). A retry of the same
 * submission reuses it; the page renders new keys after each successful change.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
