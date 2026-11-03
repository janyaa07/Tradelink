import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * OPS-02: parallel checkouts must never oversell. Runs against a real Supabase project,
 * so it is opt-in: RUN_DB_TESTS=1 with NEXT_PUBLIC_SUPABASE_URL and the publishable key set.
 * It creates one uniquely named product, which the caller can hide afterwards.
 */
const enabled = process.env.RUN_DB_TESTS === "1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const PASSWORD = "Tradelink-demo-2026";
const OPENING_STOCK = 10;
const ATTEMPTS_PER_BUYER = 12;

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe.runIf(enabled)("stock reservations under concurrency", () => {
  it("reserves at most the stock available and keeps the stock history consistent", async () => {
    const [supplier, mei, arif] = await Promise.all([
      signedIn("priya@harbourdry.example"),
      signedIn("mei@noodlehouse.example"),
      signedIn("arif@seaside.example"),
    ]);

    const name = `Concurrency check ${Date.now()}`;
    const created = await supplier.rpc("supplier_add_product", {
      p_name: name,
      p_unit: "pack",
      p_price: 1,
      p_opening: OPENING_STOCK,
      p_reorder: 0,
      p_category: "supplies",
      p_art: "box",
      p_key: crypto.randomUUID(),
    });
    expect(created.error).toBeNull();
    const productId = String((created.data as { productId: string }).productId);

    const attempt = (buyer: SupabaseClient, qty: number) =>
      buyer.rpc("place_orders", {
        p_lines: [{ productId, qty, sourceText: "concurrency" }],
        p_draft_version: null,
        p_key: crypto.randomUUID(),
      });
    const requests = Array.from({ length: ATTEMPTS_PER_BUYER }, (_, index) => [
      attempt(mei, (index % 3) + 1),
      attempt(arif, ((index + 1) % 3) + 1),
    ]).flat();
    const results = await Promise.all(requests);

    const succeeded = results.filter((result) => !result.error);
    const failures = results.filter((result) => result.error);
    for (const failure of failures) expect(failure.error?.message).toMatch(/TL409:STOCK_SHORT/);

    const { data: level } = await supplier.from("inventory_levels").select("on_hand, reserved").eq("product_id", productId).single();
    const { data: lines } = await supplier.from("order_lines").select("qty").eq("product_id", productId);
    const reservedByOrders = (lines ?? []).reduce((total, line) => total + Number(line.qty), 0);

    expect(succeeded.length).toBeGreaterThan(0);
    expect(level?.on_hand).toBe(OPENING_STOCK);
    expect(level?.reserved).toBeLessThanOrEqual(OPENING_STOCK);
    expect(level?.reserved).toBe(reservedByOrders);

    const { data: movements } = await supplier.from("stock_movements").select("on_hand_change, reserved_change").eq("product_id", productId);
    const history = (movements ?? []).reduce(
      (sum, row) => ({ onHand: sum.onHand + row.on_hand_change, reserved: sum.reserved + row.reserved_change }),
      { onHand: 0, reserved: 0 },
    );
    expect(history).toEqual({ onHand: level?.on_hand, reserved: level?.reserved });
  }, 60_000);
});
