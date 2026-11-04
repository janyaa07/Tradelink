import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
  CardAction,
  CardAudience,
  CardEnvelope,
  CardQuestion,
  CardState,
  CardType,
  SubjectKind,
} from "./envelope";

export type BuildContext = {
  /** Reads the subject. The server passes the admin client, so every query must scope by shopId itself. */
  db: SupabaseClient;
  subject: { kind: SubjectKind; id: string };
  /** The shop the caller acts for (from the session or agent context, never from the model). */
  shopId: string;
  now: Date;
};

/** A card's content as loaded from the database, before it is validated and stored. */
export type Hydrated<D> = {
  data: D;
  state: CardState;
  subjectVersion: number;
  audience: CardAudience;
  supplierId: string | null;
  expiresAt: string | null;
};

/** One database function call, made as the signed-in user. */
export type RpcCall = { name: string; args: Record<string, unknown> };

export type ActContext = {
  card: CardEnvelope;
  /** The client's id for this tap, sent as p_key so a retry is a no-op. */
  key: string;
};

/** What happens to the card once its action succeeded. */
export type AfterAct = { kind: "rerender" } | { kind: "set_state"; state: CardState; actions: CardAction[] };

export type FieldChange = { lineId: string; qty: number };

/**
 * One card type in the registry (docs/AI_DESIGN.md, section 4.2). Methods (not function properties) keep
 * the registry assignable to CardDefinition<unknown>.
 */
export interface CardDefinition<D> {
  readonly type: CardType;
  readonly schemaVersion: number;
  readonly subjectKinds: readonly SubjectKind[];
  /** Unprompted cards must say why they appeared (section 4.6). */
  readonly requiresReason: boolean;
  readonly requiresQuestion: boolean;
  readonly dataSchema: z.ZodType<D>;
  build(ctx: BuildContext): Promise<Hydrated<D>>;
  /** The buttons for this state, each enabled only where its function would accept it. */
  actions(hydrated: Hydrated<D>, question: CardQuestion | null, now: Date): CardAction[];
  /** Maps a tap to exactly one database function. Throws CardError for an action with no function. */
  act(ctx: ActContext, actionId: string, input: unknown): RpcCall;
  after(ctx: ActContext, actionId: string): AfterAct;
  /** Saves edited fields as a new subject version, for types with editable fields. */
  revise?(ctx: ActContext, changes: FieldChange[]): RpcCall;
}
