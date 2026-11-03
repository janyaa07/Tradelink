import Link from "next/link";
import { plural } from "@/domain/catalogue";
import { cx } from "../cx";
import type { CartSummary } from "./types";

type CartBarProps = CartSummary & {
  className?: string;
};

/** Sits above the bottom tabs on phone and at the foot of the main column from 760px. */
export function CartBar({ count, totalLabel, href, className }: CartBarProps) {
  return (
    <div data-cartbar="" className={cx(className, "min-w-0 bg-bg px-3 py-2")}>
      <Link
        href={href}
        className="mx-auto flex w-full max-w-[680px] items-center gap-2.5 rounded-[14px] bg-accent px-4 py-3 font-bold text-on-accent no-underline shadow-card"
      >
        <span>{plural(count, "item")}</span>
        <b className="tabular-nums">{totalLabel}</b>
        <span className="ml-auto">View order</span>
      </Link>
    </div>
  );
}
