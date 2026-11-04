import "server-only";
import { z } from "zod";
import type { Session } from "@/data/session";
import type { AiCard, AskCard } from "@/domain/ask/types";
import type { ActionResult } from "@/lib/errors";

/** Who is asking. Every tool runs as this person, so RLS and the database functions decide. */
export type AiContext = {
  session: Session;
  role: "buyer" | "supplier";
  now: Date;
  /** The next short card key for a prefix, such as "P3". */
  cardKey: (prefix: string) => string;
};

export type ReadResult = {
  /** What the model sees: small, plain JSON from the database. */
  data: unknown;
  /** Cards the person sees under the answer. */
  cards?: AskCard[];
};

export type Proposal = {
  title: string;
  details: string[];
  confirmLabel: string;
  /** Arguments to run with; may add ids the model never saw, such as an order id for a number. */
  args: Record<string, unknown>;
};

/** What a change returns: the words to show and, when the card should redraw, its new state. */
export type ExecResult = { ok: true; data: string; card?: AiCard } | Extract<ActionResult<string>, { ok: false }>;

type Base<I extends z.ZodType> = { name: string; description: string; input: I };

/** Looks something up and returns it at once. */
export type ReadTool<I extends z.ZodType = z.ZodType> = Base<I> & {
  kind: "read";
  run: (ctx: AiContext, input: z.infer<I>) => Promise<ReadResult>;
};

/**
 * Changes something. The model only proposes it: the person sees a confirm card, and `exec` runs
 * when they tap Confirm, with the proposal id as the idempotency key. A `cardOnly` tool is not
 * offered to the model at all: it runs only from a button on a card, such as a filled-in form.
 */
export type WriteTool<I extends z.ZodType = z.ZodType> = Base<I> & {
  kind: "write";
  cardOnly?: boolean;
  propose: (ctx: AiContext, input: z.infer<I>) => Promise<Proposal | { error: string }>;
  exec: (ctx: AiContext, args: z.infer<I>, key: string) => Promise<ExecResult>;
};

export type AiTool = ReadTool | WriteTool;

export function readTool<I extends z.ZodType>(tool: Omit<ReadTool<I>, "kind">): ReadTool {
  return { kind: "read", ...tool } as unknown as ReadTool;
}

export function writeTool<I extends z.ZodType>(tool: Omit<WriteTool<I>, "kind">): WriteTool {
  return { kind: "write", ...tool } as unknown as WriteTool;
}

/** A change made only from a card's own button; the model never sees or proposes it. */
export function cardTool<I extends z.ZodType>(tool: Omit<WriteTool<I>, "kind" | "cardOnly" | "propose">): WriteTool {
  return writeTool({ ...tool, cardOnly: true, propose: async () => ({ error: "This runs from its card." }) });
}

/** The Claude tool definition: name, description and a JSON Schema built from the Zod input. */
export function toClaudeTool(tool: AiTool) {
  const schema = z.toJSONSchema(tool.input, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: tool.name,
    description:
      tool.kind === "write" ? `${tool.description} Shows the person a confirm card; nothing changes until they tap Confirm.` : tool.description,
    input_schema: { type: "object" as const, ...schema },
  };
}
