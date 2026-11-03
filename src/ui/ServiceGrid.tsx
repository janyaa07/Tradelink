import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type ServiceGridProps = {
  label?: string;
  children: ReactNode;
};

/** Eight quick actions: four per row on phone, one row of eight from 760px. */
export function ServiceGrid({ label = "Quick actions", children }: ServiceGridProps) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-4 gap-x-0.5 gap-y-3 rounded-xl border border-line bg-surface px-1.5 py-3 shadow-card rail:grid-cols-8"
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
  "flex min-w-0 flex-col items-center gap-[5px] rounded-md p-0.5 text-center text-[.74rem] font-semibold leading-[1.2] text-ink no-underline";

function TileBody({ label, icon, count = 0 }: TileContent) {
  return (
    <>
      <span className="relative grid size-[46px] place-items-center rounded-tile bg-accent-soft text-accent">
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
