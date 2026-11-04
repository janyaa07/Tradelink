"use client";

import type { MouseEvent, ReactNode } from "react";
import { cx } from "./cx";

/** Clicks on these do their own thing and never open the row. */
const OWN_CONTROLS = "a, button, input, select, textarea, label, summary, [role=button]";

/**
 * A table row. When it holds a RowLink, a click anywhere on the row follows that link. The click is
 * passed to the row's own link instead of a stretched overlay, because Safari does not position
 * overlays inside table rows and every row's overlay would cover the whole table.
 */
export function Row({ children, selected }: { children: ReactNode; selected?: boolean }) {
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || !(event.target instanceof Element) || event.target.closest(OWN_CONTROLS)) return;
    // Selecting text in a row is not a click on it.
    if (window.getSelection()?.toString()) return;
    event.currentTarget.querySelector<HTMLAnchorElement>("a[data-row-link]")?.click();
  };
  return (
    <tr
      onClick={open}
      className={cx("transition-colors duration-150 hover:bg-sunken/60 has-[a[data-row-link]]:cursor-pointer", selected && "bg-accent-soft/60")}
    >
      {children}
    </tr>
  );
}
