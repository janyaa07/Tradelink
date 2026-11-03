import Link from "next/link";
import { cx } from "./cx";

export const segmentedGroupClass = "inline-flex max-w-full gap-0.5 rounded-[10px] bg-sunken p-[3px]";

export function segmentedItemClass(active: boolean): string {
  return cx(
    "inline-flex min-h-8 items-center rounded-lg px-3 py-[5px] text-[.875rem] font-semibold no-underline transition-colors duration-150",
    active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
  );
}

export type SegmentedItem = {
  href: string;
  label: string;
  current: boolean;
};

type SegmentedProps = {
  /** Names the group for screen readers, such as "Order views". */
  label: string;
  items: SegmentedItem[];
};

export function Segmented({ label, items }: SegmentedProps) {
  return (
    <div role="group" aria-label={label} className={segmentedGroupClass}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.current ? "page" : undefined}
          className={segmentedItemClass(item.current)}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
