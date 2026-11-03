import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Column counts that divide the tile count, so the last row is never lopsided. */
const COLUMNS = {
  6: "grid-cols-3 gap-y-4 py-4 rail:grid-cols-6",
  8: "grid-cols-4 gap-y-3 py-3 rail:grid-cols-8",
} as const;

type ServiceGridProps = {
  label?: string;
  /** How many tiles: six show three per row on phone and one row from 760px; eight show four, then one row. */
  columns?: keyof typeof COLUMNS;
  children: ReactNode;
};

/** Quick actions in centred, even rows. */
export function ServiceGrid({ label = "Quick actions", columns = 8, children }: ServiceGridProps) {
  return (
    <section
      aria-label={label}
      className={`grid justify-items-center gap-x-0.5 rounded-[24px] border border-line bg-surface px-1.5 shadow-card ${COLUMNS[columns]}`}
    >
      {children}
    </section>
  );
}

type TileContent = {
  label: string;
  icon: IconName;
  /** Red count, only when something needs action. */
  count?: number;
};

type ServiceTileProps =
  | (TileContent & { href: string })
  | (TileContent & { href?: undefined } & Omit<ComponentPropsWithoutRef<"button">, "children">);

const tileClass =
  "flex w-full min-w-0 max-w-[112px] flex-col items-center gap-1.5 rounded-xl p-0.5 text-center text-[.76rem] font-medium leading-[1.2] text-ink no-underline";

function TileBody({ label, icon, count = 0 }: TileContent) {
  return (
    <>
      <span className="relative grid size-[48px] place-items-center rounded-[18px] bg-accent-soft text-accent">
        <Icon name={icon} size={23} />
        {count > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-[5px] -right-[7px] rounded-full bg-bad px-1.5 text-[.7rem] font-semibold tabular-nums text-on-accent"
          >
            {count}
          </span>
        ) : null}
      </span>
      <span>
        {label}
        {count > 0 ? <span className="sr-only">, {count} to do</span> : null}
      </span>
    </>
  );
}

export function ServiceTile(props: ServiceTileProps) {
  if (props.href !== undefined) {
    const { href, label, icon, count } = props;
    return (
      <Link href={href} className={tileClass}>
        <TileBody label={label} icon={icon} count={count} />
      </Link>
    );
  }
  const { label, icon, count, type = "button", className, ...rest } = props;
  return (
    <button type={type} className={`${tileClass} border-0 bg-transparent ${className ?? ""}`} {...rest}>
      <TileBody label={label} icon={icon} count={count} />
    </button>
  );
}
