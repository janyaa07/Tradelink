import type { ReactNode } from "react";

export type PillTone = "good" | "warn" | "bad" | "info" | "plain";

const TONES: Record<PillTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "text-accent shadow-[inset_0_0_0_1px_var(--accent)]",
  plain: "bg-sunken text-muted shadow-[inset_0_0_0_1px_var(--line)]",
};

type PillProps = {
  tone?: PillTone;
  /** Always a word, so state never depends on colour alone. */
  children: ReactNode;
};

export function Pill({ tone = "plain", children }: PillProps) {
  return (
    <span
      className={`inline-block flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[.75rem] font-semibold leading-[1.45] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
