import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/data/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const { BUYER_TOOLS } = await import("./buyer-tools");
const { SUPPLIER_TOOLS } = await import("./supplier-tools");
const { toClaudeTool } = await import("./registry");
const { orderNumberInput } = await import("./shared");

describe("Tradelink AI tools", () => {
  it.each([
    ["buyer", BUYER_TOOLS],
    ["supplier", SUPPLIER_TOOLS],
  ])("gives every %s tool a unique name and a JSON object schema Claude accepts", (_role, tools) => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) {
      const claude = toClaudeTool(tool);
      expect(claude.name).toMatch(/^[a-z_]{2,40}$/);
      expect(claude.input_schema.type).toBe("object");
      expect(claude.input_schema).not.toHaveProperty("$schema");
      if (tool.kind === "write") expect(claude.description).toContain("confirm card");
    }
  });

  it("reads order numbers the way people write them", () => {
    expect(orderNumberInput.parse("ORD-1044")).toBe(1044);
    expect(orderNumberInput.parse("1044")).toBe(1044);
    expect(orderNumberInput.parse(1044)).toBe(1044);
    expect(orderNumberInput.safeParse("my order").success).toBe(false);
  });

  it("lets each side message the other and agree delivery date changes", () => {
    const buyer = new Set(BUYER_TOOLS.map((tool) => tool.name));
    const supplier = new Set(SUPPLIER_TOOLS.map((tool) => tool.name));
    for (const name of ["get_order_messages", "request_date_change", "answer_date_change", "cancel_rest"]) {
      expect(buyer.has(name) && supplier.has(name), name).toBe(true);
    }
    expect(buyer.has("message_supplier") && !buyer.has("message_buyer")).toBe(true);
    expect(supplier.has("message_buyer") && !supplier.has("message_supplier")).toBe(true);
    expect(supplier.has("deliver_rest") && !buyer.has("deliver_rest")).toBe(true);
  });

  it("only lets suppliers change stock and prices, and only buyers place orders", () => {
    const buyer = new Set(BUYER_TOOLS.map((tool) => tool.name));
    const supplier = new Set(SUPPLIER_TOOLS.map((tool) => tool.name));
    expect(buyer.has("place_order") && !supplier.has("place_order")).toBe(true);
    expect(supplier.has("change_price") && !buyer.has("change_price")).toBe(true);
  });

  it("keeps adding products and suppliers to the form cards, never a model proposal", async () => {
    for (const tool of [...BUYER_TOOLS, ...SUPPLIER_TOOLS].filter((entry) => entry.name === "add_product" || entry.name === "add_supplier")) {
      expect(tool.kind === "write" && tool.cardOnly).toBe(true);
      if (tool.kind === "write") expect(await tool.propose({} as never, {} as never)).toHaveProperty("error");
    }
    expect(BUYER_TOOLS.some((tool) => tool.name === "new_product_form")).toBe(true);
    expect(SUPPLIER_TOOLS.some((tool) => tool.name === "new_product_form")).toBe(true);
  });

  it("lets suppliers do from chat what their screens do", () => {
    const names = new Set(SUPPLIER_TOOLS.map((tool) => tool.name));
    for (const name of ["accept_part", "confirm_stock", "adjust_stock", "update_terms"]) expect(names.has(name)).toBe(true);
    const adjust = SUPPLIER_TOOLS.find((tool) => tool.name === "adjust_stock");
    expect(adjust?.input.safeParse({ product_id: crypto.randomUUID(), change: 0, reason: "damaged" }).success).toBe(false);
    expect(adjust?.input.safeParse({ product_id: crypto.randomUUID(), change: -2, reason: "damaged" }).success).toBe(true);
  });

  it("places a direct order without the cart version, so the cart is left alone", () => {
    const tool = BUYER_TOOLS.find((entry) => entry.name === "order_now");
    expect(tool?.kind).toBe("write");
    expect(tool?.input.safeParse({ items: [{ product_id: crypto.randomUUID(), qty: 1 }] }).success).toBe(true);
    expect(tool?.input.safeParse({ items: [] }).success).toBe(false);
  });
});
