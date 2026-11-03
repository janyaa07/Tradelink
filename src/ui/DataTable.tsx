import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type Column = {
  label: string;
  align?: "left" | "right";
  /** A fixed width such as w-28, for dates and money. */
  className?: string;
  /** Read by screen readers only, such as a column of row buttons. */
  hidden?: boolean;
};

type DataTableProps = {
  label: string;
  columns: Column[];
  children: ReactNode;
  /** The phone version: usually the page's existing row list. Without it the table scrolls sideways. */
  phone?: ReactNode;
  footer?: ReactNode;
};

/**
 * A list as a table on a laptop, in one card. On a phone the same rows show as the page's own list,
 * since a six-column table does not fit.
 */
export function DataTable({ label, columns, children, phone, footer }: DataTableProps) {
  return (
    <>
      {phone ? <div className="rail:hidden">{phone}</div> : null}
      <section aria-label={label} className={cx("overflow-x-auto rounded-xl border border-line bg-surface", phone ? "hidden rail:block" : null)}>
        <table className="w-full border-collapse text-[.84rem]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={cx(
                    "border-b border-line bg-[color-mix(in_srgb,var(--color-sunken)_50%,var(--color-surface))] px-3.5 py-2.5 text-[.72rem] font-semibold whitespace-nowrap text-muted",
                    column.align === "right" ? "text-right" : "text-left",
                    column.className,
                  )}
                >
                  {column.hidden ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">{children}</tbody>
        </table>
        {footer ? <div className="border-t border-line px-3.5 py-2.5 text-[.8rem] text-muted">{footer}</div> : null}
      </section>
    </>
  );
}

/** A table row. With href the whole row opens it, through a link on its first cell's text. */
export function Row({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return <tr className={cx("relative transition-colors duration-150 hover:bg-sunken/60", selected && "bg-accent-soft/60")}>{children}</tr>;
}

type CellProps = {
  children?: ReactNode;
  align?: "left" | "right";
  muted?: boolean;
  strong?: boolean;
  /** Numbers and dates line up. */
  num?: boolean;
  className?: string;
};

export function Cell({ children, align, muted, strong, num, className }: CellProps) {
  return (
    <td
      className={cx(
        "border-b border-line/70 px-3.5 py-2.5 align-middle",
        align === "right" && "text-right",
        muted && "text-muted",
        strong && "font-semibold",
        num && "num whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** The link that makes a whole row clickable; buttons in the row sit above it. */
export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline">
      {children}
    </Link>
  );
}

/** A table cell's own controls stay clickable above the row link. */
export function CellActions({ children }: { children: ReactNode }) {
  return <div className="relative z-[1] flex items-center justify-end gap-1.5">{children}</div>;
}
