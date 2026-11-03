"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/ui/cx";

export type GlanceTab = { id: string; label: string; count: number; content: ReactNode };

/** At a glance: everything that is not the next step, one tab at a time. Arrow keys move between tabs. */
export function GlanceTabs({ tabs }: { tabs: GlanceTab[] }) {
  const [current, setCurrent] = useState(tabs[0]?.id ?? "");
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, tabs.findIndex((tab) => tab.id === current));

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    setCurrent(tab.id);
    refs.current[next]?.focus();
  };

  return (
    <section aria-label="At a glance" className="rounded-lg border border-line bg-surface px-4 pt-4 pb-2 shadow-card rail:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>At a glance</h2>
        <div role="tablist" aria-label="At a glance" className="flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] bg-sunken p-[3px]">
          {tabs.map((tab, position) => {
            const selected = position === index;
            return (
              <button
                key={tab.id}
                ref={(element) => {
                  refs.current[position] = element;
                }}
                id={`${baseId}-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-${tab.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setCurrent(tab.id)}
                onKeyDown={onKeyDown}
                className={cx(
                  "min-h-8 flex-none rounded-lg border-0 px-3 text-[.84rem] font-semibold whitespace-nowrap transition-colors duration-150",
                  selected ? "bg-surface text-ink shadow-card" : "bg-transparent text-muted hover:text-ink",
                )}
              >
                {tab.label}
                <span className="ml-1 tabular-nums text-muted">{tab.count}</span>
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab, position) => (
        <div
          key={tab.id}
          id={`${baseId}-${tab.id}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-${tab.id}-tab`}
          hidden={position !== index}
          className="mt-2"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
