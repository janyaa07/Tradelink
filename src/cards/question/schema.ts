import { z } from "zod";

export const QuestionDataSchema = z.object({
  /** What the question is about, loaded from the subject ("Order of 3 Nov, 14:05"). */
  subjectLabel: z.string().min(1).max(120),
});
export type QuestionData = z.infer<typeof QuestionDataSchema>;

export const ANSWER_PREFIX = "answer.";

export const answerActionId = (optionId: string) => `${ANSWER_PREFIX}${optionId}`;
