import Link from "next/link";
import { cx } from "../cx";
import { Icon } from "../Icon";
import { MoreSheet } from "./MoreSheet";
import { navCountClass, navIconClass, navItemClass, navLabelClass } from "./navStyles";
import type { NavItem } from "./types";

const MAX_TABS = 5;
const TABS_BEFORE_MORE = 4;

type ShellNavProps = {
  items: NavItem[];
  activeHref: string;
  className?: string;
};

/** Bottom tabs on phone: four plus More when there are more than five. Hidden from 760px, where the top bar holds the sections. */
export function ShellNav({ items, activeHref, className }: ShellNavProps) {
  const hasMore = items.length > MAX_TABS;
  const extras = hasMore ? items.slice(TABS_BEFORE_MORE) : [];

  return (
    <nav
      aria-label="Main"
      className={cx(
        className,
        "flex min-w-0 border-t border-line bg-surface px-1 pt-[5px] pb-[max(5px,env(safe-area-inset-bottom))]",
      )}
    >
      {items.map((item, index) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(navItemClass(active), hasMore && index >= TABS_BEFORE_MORE && "hidden")}
          >
            <span className={navIconClass(active)}>
              {item.icon === "spark" ? <span aria-hidden="true" className="ai-spark size-5" /> : <Icon name={item.icon} size={20} />}
            </span>
            <span className={navLabelClass}>{item.label}</span>
            {item.count ? <span className={navCountClass}>{item.count}</span> : null}
          </Link>
        );
      })}
      {hasMore ? <MoreSheet items={extras} activeHref={activeHref} /> : null}
    </nav>
  );
}
