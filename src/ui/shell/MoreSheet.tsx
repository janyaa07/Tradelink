"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { Icon } from "../Icon";
import { navCountClass, navIconClass, navItemClass, navLabelClass } from "./navStyles";
import type { NavItem } from "./types";

type MoreSheetProps = {
  items: NavItem[];
  activeHref: string;
};

/** The phone "More" tab and its bottom sheet. Escape, the scrim and Close all close it. */
export function MoreSheet({ items, activeHref }: MoreSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const current = items.some((item) => item.href === activeHref);
  const count = items.reduce((total, item) => total + (item.count ?? 0), 0);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-current={current ? "page" : undefined}
        onClick={() => dialogRef.current?.showModal()}
        className={`${navItemClass(current)} rail:hidden`}
      >
        <span className={navIconClass(current)}>
          <Icon name="more" size={20} />
        </span>
        <span className={navLabelClass}>More</span>
        {count > 0 ? <span className={navCountClass}>{count}</span> : null}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => triggerRef.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-sheet border-0 bg-surface p-0 text-ink backdrop:bg-scrim"
      >
        <div className="flex flex-col gap-1 px-4 pt-2.5 pb-[max(18px,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3 px-0.5 pt-1.5 pb-2">
            <h2 id={titleId}>More</h2>
            <button
              type="button"
              onClick={close}
              className="min-h-6 rounded-sm border-0 bg-transparent px-1 font-bold text-accent"
            >
              Close
            </button>
          </div>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={item.href === activeHref ? "page" : undefined}
              className="flex w-full items-center gap-3 border-b border-line px-1 py-[11px] font-semibold text-ink no-underline last:border-b-0 aria-[current=page]:text-accent"
            >
              <Icon name={item.icon} size={21} className="text-accent" />
              <span>{item.label}</span>
              {item.count ? (
                <span className="ml-auto rounded-full bg-warn-soft px-1.5 text-[.7rem] font-semibold tabular-nums text-warn">
                  {item.count}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </dialog>
    </>
  );
}
