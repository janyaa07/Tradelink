/** Problem types a buyer can report on a delivered line, with their labels (BUY-30). */
export const PROBLEM_TYPES = ["short", "damaged", "wrong_item", "expired"] as const;
export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const ISSUE_TYPE_LABELS: Record<ProblemType | "late" | "invoice", string> = {
  short: "Short",
  damaged: "Damaged",
  wrong_item: "Wrong item",
  expired: "Expired",
  late: "Late",
  invoice: "Invoice",
};
