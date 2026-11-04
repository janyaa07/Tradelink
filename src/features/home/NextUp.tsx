"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/ui/cx";
import { Icon } from "@/ui/Icon";
import type { StepTone } from "./HomeParts";

/** One thing that needs the person, ready to show big or as a row. */
export type NextStep = {
  key: string;
  title: string;
  /** A few words after the title in the row, such as "2 items, S$108.60". */
  summary: string;
  tone: StepTone;
  detail: ReactNode;
  /** More under the detail, such as the items in tomorrow's order. */
  extra?: ReactNode;
  actions: ReactNode;
  /** Tradelink AI's reasoning, behind "Why this?". */
  why?: string;
};

const DOTS: Record<StepTone, string> = { bad: "bg-bad", warn: "bg-[#C98A1A]", info: "bg-info", good: "bg-good" };

const arrowClass =
  "grid size-7 place-items-center rounded-md border border-line bg-surface text-ink hover:bg-sunken disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface";

function Chevron({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** The step on show: title, detail, actions and the reasoning one tap away. Keyed by step, so "Why this?" closes on a new one. */
function Current({ step }: { step: NextStep }) {
  const [open, setOpen] = useState(false);
  const whyId = useId();
  return (
    <div aria-live="polite">
      <h2 className="mt-2 text-[1.15rem] tracking-[-0.015em] rail:text-[1.25rem]">{step.title}</h2>
      <div className="mt-1 text-[.875rem] leading-relaxed text-ink/80">{step.detail}</div>
      {step.extra ? <div className="mt-3">{step.extra}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {step.actions}
        <span className="flex-1" />
        {step.why ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={whyId}
            onClick={() => setOpen(!open)}
            className="inline-flex min-h-8 items-center gap-1 border-0 bg-transparent px-1 text-[.8rem] font-semibold text-[var(--ai-text-2)]"
          >
            Why this?
            <span className={cx("transition-transform duration-150", open && "rotate-180")}>
              <Chevron d="M6 9l6 6 6-6" />
            </span>
          </button>
        ) : null}
      </div>
      {step.why ? (
        <p id={whyId} hidden={!open} className="ai-tint mt-3 rounded-lg px-3.5 py-3 text-[.85rem] leading-relaxed">
          {step.why}
        </p>
      ) : null}
    </div>
  );
}

/** A last row that leads to the full list, when the deck shows only the first few. */
export type MoreLink = { href: string; label: string };

/** What needs the person, most important first. One shows big; the arrows or a tap on a row bring another forward. */
export function NextUp({ steps, more }: { steps: NextStep[]; more?: MoreLink }) {
  const [index, setIndex] = useState(0);
  const current = steps[Math.min(index, steps.length - 1)];
  if (!current) return null;
  const at = steps.indexOf(current);
  const others = steps.map((step, position) => ({ step, position })).filter(({ position }) => position !== at);
  return (
    <section aria-label="Next up" className="ai-ring rounded-2xl px-4 pt-4 pb-1.5 rail:px-5">
      <div className="flex items-center gap-1.5 text-[.75rem]">
        <span aria-hidden="true" className="ai-spark size-3.5" />
        <span className="ai-text font-semibold">Next up</span>
        <span className="text-muted">
          · {at + 1} of {steps.length}
        </span>
        {steps.length > 1 ? (
          <span className="ml-auto flex gap-1">
            <button type="button" className={arrowClass} onClick={() => setIndex(at - 1)} disabled={at === 0} aria-label="Previous step">
              <Chevron d="M15 6l-6 6 6 6" />
            </button>
            <button type="button" className={arrowClass} onClick={() => setIndex(at + 1)} disabled={at === steps.length - 1} aria-label="Next step">
              <Chevron d="M9 6l6 6-6 6" />
            </button>
          </span>
        ) : null}
      </div>
      <Current key={current.key} step={current} />
      {others.length > 0 ? (
        <ul aria-label="Other steps" className="mt-4">
          {others.map(({ step, position }) => (
            <li key={step.key}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                className="flex w-full items-center gap-2.5 border-0 border-t border-solid border-line bg-transparent px-1 py-2.5 text-left text-ink hover:bg-sunken/60"
              >
                <span aria-hidden="true" className={cx("size-2 flex-none rounded-full", DOTS[step.tone])} />
                <span className="min-w-0 flex-1 truncate text-[.85rem]">
                  <b className="font-semibold">{step.title}</b> <span className="text-muted">· {step.summary}</span>
                </span>
                <Icon name="arrow" size={16} className="text-muted" />
              </button>
            </li>
          ))}
          {more ? (
            <li>
              <Link
                href={more.href}
                className="flex w-full items-center gap-2.5 border-t border-line px-1 py-2.5 text-[.85rem] font-semibold text-accent no-underline hover:bg-sunken/60"
              >
                <span className="min-w-0 flex-1">{more.label}</span>
                <Icon name="arrow" size={16} />
              </Link>
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="h-2.5" />
      )}
    </section>
  );
}

/** Shown when nothing needs the person. */
export function AllClear({ text }: { text: string }) {
  return (
    <section aria-label="Next up" className="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card">
      <span className="grid size-9 flex-none place-items-center rounded-full bg-good-soft text-good">
        <Icon name="check" size={18} />
      </span>
      <p className="text-[.9rem]">{text}</p>
    </section>
  );
}
