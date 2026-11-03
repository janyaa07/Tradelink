import Link from "next/link";
import { cx } from "../cx";
import { Icon, type IconName } from "../Icon";

type TopBarLinkProps = {
  href: string;
  icon: IconName;
  /** Read with the count, such as "Alerts" or "Cart". */
  label: string;
  /** Words for the count, such as "new" or "in cart". */
  countLabel: string;
  count: number;
  current?: boolean;
};

/** A round icon link in the top bar, with a count badge when the count is above 0. */
export function TopBarLink({ href, icon, label, countLabel, count, current = false }: TopBarLinkProps) {
  const name = count > 0 ? `${label}, ${count} ${countLabel}` : label;
  return (
    <Link
      href={href}
      aria-label={name}
      title={label}
      aria-current={current ? "page" : undefined}
      className={cx(
        "relative grid size-9 flex-none place-items-center rounded-full border no-underline transition-colors duration-150",
        current ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:border-accent hover:text-accent",
      )}
    >
      <Icon name={icon} size={19} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1.5 min-w-[18px] rounded-full bg-bad px-[5px] text-center text-[.68rem] font-semibold leading-[18px] tabular-nums text-on-accent ring-2 ring-surface"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
