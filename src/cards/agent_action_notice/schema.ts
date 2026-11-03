import { z } from "zod";

export const AgentActionNoticeDataSchema = z.object({
  actionId: z.guid(),
  /** What Restock did, in the words the server logged with the action. */
  text: z.string().min(1).max(240),
  undoUntil: z.string().nullable(),
  undoneAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentActionNoticeData = z.infer<typeof AgentActionNoticeDataSchema>;
