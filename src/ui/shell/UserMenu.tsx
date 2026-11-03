"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BusinessLogo } from "../BusinessLogo";
import { cx } from "../cx";
import { Icon } from "../Icon";

export type UserMenuProps = {
  userName: string;
  orgName: string;
  roleLabel: string;
  /** The sign-out server action. */
  signOutAction: () => Promise<void>;
  /** "avatar" is the round logo in the top bar; "who" is the side rail's name block on laptop. */
  variant?: "avatar" | "who";
  className?: string;
};

/**
 * The account menu: name, business and Sign out. A disclosure: the trigger carries
 * aria-expanded, focus moves to Sign out on open, and Escape or a click outside closes it.
 */
export function UserMenu({ userName, orgName, roleLabel, signOutAction, variant = "avatar", className }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
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

  const who = variant === "who";

  return (
    <div
      ref={wrapperRef}
      className={cx("relative", who && "w-full", className)}
      onBlur={(event) => {
        if (open && !(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={who ? undefined : `Account menu for ${userName}`}
        onClick={() => setOpen((value) => !value)}
        className={
          who
            ? "flex w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2 py-2 text-left text-[.875rem] text-ink transition-colors duration-150 hover:bg-sunken aria-expanded:bg-sunken"
            : "grid size-9 flex-none place-items-center rounded-full border-0 bg-transparent p-0 ring-offset-2 ring-offset-surface transition-shadow duration-150 hover:ring-2 hover:ring-line aria-expanded:ring-2 aria-expanded:ring-accent"
        }
      >
        <BusinessLogo name={orgName} size={34} />
        {who ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{userName}</span>
              <span className="block truncate text-[.78rem] text-muted">{orgName}</span>
            </span>
            <Icon name="more" size={18} className="text-muted" />
            <span className="sr-only">, account menu</span>
          </>
        ) : null}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cx(
          "absolute z-30 w-[min(280px,calc(100vw-24px))] rounded-lg border border-line bg-surface p-1.5 text-ink shadow-card",
          who ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2",
        )}
      >
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
          <BusinessLogo name={orgName} size={40} />
          <div className="min-w-0">
            <p className="break-words font-semibold leading-tight">{userName}</p>
            <p className="break-words text-[.84rem] text-muted">{orgName}</p>
            <p className="text-[.75rem] text-muted">{roleLabel}</p>
          </div>
        </div>
        <div className="border-t border-line pt-1.5">
          <form action={signOutAction}>
            <button
              ref={firstActionRef}
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left font-medium text-ink hover:bg-sunken"
            >
              <Icon name="logout" size={18} className="text-muted" />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
