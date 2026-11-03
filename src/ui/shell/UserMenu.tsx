"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { BusinessLogo } from "../BusinessLogo";
import { cx } from "../cx";
import { Icon } from "../Icon";

export type UserMenuProps = {
  userName: string;
  orgName: string;
  roleLabel: string;
  /** The role's settings page, listed above Sign out. */
  settingsHref: string;
  /** The sign-out server action. */
  signOutAction: () => Promise<void>;
  className?: string;
};

const itemClass =
  "flex w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-ink no-underline hover:bg-sunken";

/**
 * The account menu: name, business, Settings and Sign out. A disclosure: the trigger carries
 * aria-expanded, focus moves to Settings on open, and Escape, a click outside or tabbing away closes it.
 */
export function UserMenu({
  userName,
  orgName,
  roleLabel,
  settingsHref,
  signOutAction,
  className,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    firstActionRef.current?.focus();
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

  return (
    <div
      ref={wrapperRef}
      className={cx("relative", className)}
      onBlur={(event) => {
        // Only when focus lands somewhere else, as with Tab. Safari does not focus a tapped button, so
        // tapping Sign out gives no new target; closing then would hide the menu before the tap lands.
        const next = event.relatedTarget;
        if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${userName}`}
        onClick={() => setOpen((value) => !value)}
        className="grid size-9 flex-none place-items-center rounded-full border-0 bg-transparent p-0 ring-offset-2 ring-offset-surface transition-shadow duration-150 hover:ring-2 hover:ring-line aria-expanded:ring-2 aria-expanded:ring-accent"
      >
        <BusinessLogo name={orgName} size={34} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-[min(280px,calc(100vw-24px))] rounded-lg border border-line bg-surface p-1.5 text-ink shadow-card"
      >
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
          <BusinessLogo name={orgName} size={40} />
          <div className="min-w-0">
            <p className="break-words font-semibold leading-tight">{userName}</p>
            <p className="break-words text-[.84rem] text-muted">{orgName}</p>
            <p className="text-[.75rem] text-muted">{roleLabel}</p>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 border-t border-line pt-1.5">
          <Link ref={firstActionRef} href={settingsHref} onClick={() => setOpen(false)} className={itemClass}>
            <Icon name="gear" size={18} className="text-muted" />
            Settings
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={itemClass}>
              <Icon name="logout" size={18} className="text-muted" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
