import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { method: string; args: unknown[] };

const mocks = vi.hoisted(() => ({
  calls: [] as Call[],
  result: { data: null as unknown, error: null as { message: string } | null },
  getConnectedSuppliers: vi.fn(),
}));

/** A query builder that records every call and resolves to mocks.result. */
function builder(): unknown {
  const target = {
    then: (resolve: (value: unknown) => unknown) => resolve(mocks.result),
  };
  return new Proxy(target, {
    get(object, property) {
      if (property === "then") return object.then;
      return (...args: unknown[]) => {
        mocks.calls.push({ method: String(property), args });
        return property === "maybeSingle" ? Promise.resolve(mocks.result) : builder();
      };
    },
  });
}

vi.mock("server-only", () => ({}));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => {
      mocks.calls.push({ method: "from", args: [table] });
      return builder();
    },
  }),
}));
vi.mock("@/features/buyer/queries", () => ({ getConnectedSuppliers: mocks.getConnectedSuppliers }));

const { getOrderCardByNumber, getSupplierRecords } = await import("./queries");

const ORG = "11111111-1111-4111-8111-111111111111";
const SUPPLIER = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.result = { data: null, error: null };
  mocks.getConnectedSuppliers.mockReset();
});

function filters(): unknown[][] {
  return mocks.calls.filter((call) => call.method === "eq").map((call) => call.args);
}

describe("getOrderCardByNumber (BUY-48.1, BUY-50.2)", () => {
  it("filters on the buyer's organisation as well as the number", async () => {
    await getOrderCardByNumber(ORG, 1044);
    expect(filters()).toEqual([
      ["buyer_org_id", ORG],
      ["number", 1044],
    ]);
  });

  it("returns null when no order on the account has that number", async () => {
    expect(await getOrderCardByNumber(ORG, 1044)).toBeNull();
  });

  it("builds the card with the total from line prices", async () => {
    mocks.result = {
      data: {
        number: 1044,
        status: "accepted",
        requested_delivery_date: "2026-11-04",
        confirmed_delivery_date: "2026-11-05",
        supplier: { name: "Harbour Dry Goods" },
        order_lines: [
          { qty: 2, unit_price: "52.00", product: { name: "Fresh eggs" } },
          { qty: 1, unit_price: 9.5, product: { name: "Tofu" } },
        ],
      },
      error: null,
    };
    expect(await getOrderCardByNumber(ORG, 1044)).toEqual({
      number: 1044,
      status: "accepted",
      supplierName: "Harbour Dry Goods",
      deliveryDate: "2026-11-05",
      lines: [
        { qty: 2, name: "Fresh eggs" },
        { qty: 1, name: "Tofu" },
      ],
      totalCents: 11350,
    });
  });
});

describe("getSupplierRecords (BUY-48.6)", () => {
  it("reads only the buyer's delivered orders and rates active connected suppliers", async () => {
    mocks.getConnectedSuppliers.mockResolvedValue([
      { id: SUPPLIER, name: "Harbour Dry Goods", status: "active" },
      { id: "55555555-5555-4555-8555-555555555555", name: "Invited Foods", status: "invited" },
    ]);
    mocks.result = {
      data: [
        // Delivered 23:30 on 4 Nov in Singapore (15:30 UTC), due 4 Nov: on time.
        { supplier_org_id: SUPPLIER, confirmed_delivery_date: "2026-11-04", requested_delivery_date: null, delivered_at: "2026-11-04T15:30:00Z" },
        // Delivered 00:30 on 5 Nov in Singapore, due 4 Nov: late.
        { supplier_org_id: SUPPLIER, confirmed_delivery_date: "2026-11-04", requested_delivery_date: null, delivered_at: "2026-11-04T16:30:00Z" },
      ],
      error: null,
    };
    const records = await getSupplierRecords(ORG);
    expect(mocks.getConnectedSuppliers).toHaveBeenCalledWith(ORG);
    expect(filters()).toEqual([
      ["buyer_org_id", ORG],
      ["status", "delivered"],
    ]);
    expect(records).toEqual([{ supplierId: SUPPLIER, name: "Harbour Dry Goods", delivered: 2, onTime: 1, percent: 50 }]);
  });
});
