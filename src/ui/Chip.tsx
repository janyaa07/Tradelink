import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "./cx";

function chipClass(selected: boolean): string {
  return cx(
    "inline-flex min-h-8 flex-none items-center rounded-full border px-[11px] py-1.5 text-[.84rem] font-semibold no-underline transition-colors duration-150",
    selected ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:border-accent",
  );
}

type ChipLinkProps = {
  href: string;
  selected?: boolean;
  children: ReactNode;
};

type ChipButtonProps = Omit<ComponentPropsWithoutRef<"button">, "aria-pressed"> & {
  href?: undefined;
  selected?: boolean;
};

export type ChipProps = ChipLinkProps | ChipButtonProps;

/** A filter. Links mark the selected chip with aria-current, buttons with aria-pressed. */
export function Chip(props: ChipProps) {
  if (props.href !== undefined) {
    const { href, selected = false, children } = props;
    return (
      <Link href={href} className={chipClass(selected)} aria-current={selected ? "true" : undefined}>
        {children}
      </Link>
    );
  }
  const { selected = false, className, type = "button", ...rest } = props;
  return <button type={type} aria-pressed={selected} className={cx(chipClass(selected), className)} {...rest} />;
}

export function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-0.5">
      {children}
    </div>
  );
}
