"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/ui/Icon";

type NextUpProps = {
  /** "1 of 3". */
  position: string;
  title: string;
  detail: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Tradelink AI's reasoning, behind "Why this?". */
  why?: string;
  /** The other steps, as quieter rows. */
  rest?: ReactNode;
};

/** The one thing that needs the person most, with the AI's reasoning one tap away. */
export function NextUp({ position, title, detail, children, actions, why, rest }: NextUpProps) {
  const [open, setOpen] = useState(false);
  const whyId = useId();
  return (
    <section aria-label="Next up" className="ai-ring rounded-2xl px-4 pt-4 pb-1.5 rail:px-5">
      <p className="flex items-center gap-1.5 text-[.75rem]">
        <span aria-hidden="true" className="ai-spark size-3.5" />
        <span className="ai-text font-semibold">Next up</span>
        <span className="text-muted">· {position}</span>
      </p>
      <h2 className="mt-2 text-[1.15rem] tracking-[-0.015em] rail:text-[1.25rem]">{title}</h2>
      <div className="mt-1 text-[.875rem] leading-relaxed text-ink/80">{detail}</div>
      {children ? <div className="mt-3">{children}</div> : null}
      {actions || why ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {actions}
          <span className="flex-1" />
          {why ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={whyId}
              onClick={() => setOpen(!open)}
              className="inline-flex min-h-8 items-center gap-1 border-0 bg-transparent px-1 text-[.8rem] font-semibold text-[var(--ai-text-2)]"
            >
              Why this?
              <svg viewBox="0 0 24 24" className={`size-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
      {why ? (
        <p id={whyId} hidden={!open} className="ai-tint mt-3 rounded-lg px-3.5 py-3 text-[.85rem] leading-relaxed">
          {why}
        </p>
      ) : null}
      {rest ? <div className="mt-4">{rest}</div> : <div className="h-2.5" />}
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
