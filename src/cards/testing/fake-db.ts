import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A small in-memory stand-in for the Supabase client in unit tests. Rows are stored already shaped
 * like the select (embedded rows included); eq and is filter on top-level columns.
 */
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string; code?: string } | null };
type RpcHandler = (name: string, args: Record<string, unknown>) => Result | Promise<Result>;

export type FakeDb = {
  client: SupabaseClient;
  rpc: { name: string; args: Record<string, unknown> }[];
  queries: { table: string; filters: [string, unknown][] }[];
};

export function fakeDb(tables: Record<string, Row[]>, options: { rpc?: RpcHandler; userId?: string | null } = {}): FakeDb {
  const calls: FakeDb["rpc"] = [];
  const queries: FakeDb["queries"] = [];

  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let limit = Infinity;
    queries.push({ table, filters });
    const rows = () => (tables[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value)).slice(0, limit);
    const builder = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      limit: (n: number) => {
        limit = n;
        return builder;
      },
      maybeSingle: async (): Promise<Result> => ({ data: rows()[0] ?? null, error: null }),
      single: async (): Promise<Result> => {
        const row = rows()[0];
        return row ? { data: row, error: null } : { data: null, error: { message: "no rows", code: "PGRST116" } };
      },
      then: (resolve: (result: Result) => unknown, reject?: (error: unknown) => unknown) =>
        Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
    };
    return builder;
  };

  const client = {
    from,
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return options.rpc ? options.rpc(name, args) : { data: null, error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: options.userId === null ? null : { id: options.userId ?? "user-1" } }, error: null }),
    },
  };
  return { client: client as unknown as SupabaseClient, rpc: calls, queries };
}
