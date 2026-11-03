"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "../Icon";

type AlertsPopoverProps = {
  /** Unread notifications plus alerts that need action. */
  count: number;
  /** The alerts, rendered on the server. */
  children: ReactNode;
};

/**
 * The bell opens alerts in a pop-up instead of a page. A disclosure: Escape, a click outside,
 * following a link inside or moving to another page closes it.
 */
export function AlertsPopover({ count, children }: AlertsPopoverProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  if (open && openedOn !== pathname) {
    setOpen(false);
    setOpenedOn(pathname);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const name = count > 0 ? `Alerts, ${count} new` : "Alerts";

  return (
    <div ref={wrapperRef} className="flex-none">
      <button
        ref={triggerRef}
        type="button"
        aria-label={name}
        title="Alerts"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpenedOn(pathname);
          setOpen((value) => !value);
        }}
        className={cx(
          "relative grid size-9 place-items-center rounded-full border transition-colors duration-150",
          open ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:border-accent hover:text-accent",
        )}
      >
        <Icon name="bell" size={19} />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1.5 min-w-[18px] rounded-full bg-bad px-[5px] text-center text-[.68rem] font-semibold leading-[18px] tabular-nums text-on-accent ring-2 ring-surface"
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label="Alerts"
        tabIndex={-1}
        hidden={!open}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
        }}
        className="fixed top-[58px] right-3 z-30 flex max-h-[min(78dvh,620px)] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-card outline-none rail:top-[62px] rail:right-5"
      >
        {children}
      </div>
    </div>
  );
}
