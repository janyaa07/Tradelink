import Link from "next/link";
import { cx } from "../cx";
import type { NavItem } from "./types";

type TopNavProps = {
  items: NavItem[];
  activeHref: string;
};

/** The section titles in the top bar from 760px, used when the role has no side rail. */
export function TopNav({ items, activeHref }: TopNavProps) {
  return (
    <nav aria-label="Main" className="-my-3 ml-5 hidden min-w-0 items-stretch self-stretch overflow-x-auto rail:flex">
      {items.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "mx-2.5 flex flex-none items-center gap-1.5 border-b-2 px-0.5 text-[.9rem] font-medium no-underline transition-colors duration-150",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {item.label}
            {item.count ? (
              <span className="rounded-md bg-warn-soft px-1.5 text-[.72rem] font-semibold tabular-nums text-warn">
                {item.count}
                <span className="sr-only"> to check</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
