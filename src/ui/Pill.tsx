import type { ReactNode } from "react";

export type PillTone = "good" | "warn" | "bad" | "info" | "plain";

const TONES: Record<PillTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  plain: "bg-sunken text-muted",
};

type PillProps = {
  tone?: PillTone;
  /** Always a word, so state never depends on colour alone. */
  children: ReactNode;
};

export function Pill({ tone = "plain", children }: PillProps) {
  return (
    <span
      className={`inline-block flex-none whitespace-nowrap rounded-md px-2 py-0.5 text-[.75rem] font-semibold leading-[1.45] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
