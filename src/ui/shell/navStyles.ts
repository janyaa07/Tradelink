import { cx } from "../cx";

/** Phone: a stacked bottom tab. From 760px: a row in the side rail. */
export function navItemClass(active: boolean): string {
  return cx(
    "relative flex min-w-0 flex-1 basis-0 flex-col items-center gap-0.5 rounded-sm border-0 bg-transparent px-0.5 pt-1.5 pb-1 text-[.72rem] font-semibold no-underline",
    "rail:flex-none rail:basis-auto rail:flex-row rail:gap-2.5 rail:rounded-md rail:px-2.5 rail:py-[9px] rail:text-left rail:text-[.92rem]",
    active ? "text-accent rail:bg-accent-soft" : "text-muted hover:text-ink",
  );
}

/** On phone the active tab also gets a soft pill behind its icon, so state is not colour alone. */
export function navIconClass(active: boolean): string {
  return cx("flex rounded-full px-3 py-0.5 rail:p-0", active && "bg-accent-soft");
}

export const navLabelClass = "max-w-full truncate";

export const navCountClass =
  "absolute top-0.5 right-[calc(50%-22px)] rounded-full bg-warn-soft px-1.5 text-[.7rem] font-semibold tabular-nums text-warn rail:static rail:ml-auto";
