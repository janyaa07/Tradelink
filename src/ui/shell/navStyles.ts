import { cx } from "../cx";

/** A stacked bottom tab on phone. The active tab has a bar on top and a bolder label, so state is not colour alone. */
export function navItemClass(active: boolean): string {
  return cx(
    "relative flex min-w-0 flex-1 basis-0 flex-col items-center gap-1 rounded-sm border-0 bg-transparent px-0.5 pt-2 pb-1 text-[.7rem] no-underline",
    "before:absolute before:top-[-5px] before:left-1/2 before:h-0.5 before:w-7 before:-translate-x-1/2 before:rounded-full",
    active ? "font-semibold text-accent before:bg-accent" : "font-medium text-muted hover:text-ink",
  );
}

export function navIconClass(active: boolean): string {
  return cx("flex", active && "text-accent");
}

export const navLabelClass = "max-w-full truncate";

export const navCountClass =
  "absolute top-0.5 right-[calc(50%-22px)] rounded-md bg-warn-soft px-1.5 text-[.68rem] font-semibold tabular-nums text-warn";
