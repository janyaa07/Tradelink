import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { cx } from "@/ui/cx";

/** The phone version of an admin table: one card of divided rows. */
export function PhoneList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {children}
    </ul>
  );
}

type PhoneRowProps = {
  href?: string;
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  /** A pill or a figure at the end of the row. */
  end?: ReactNode;
};

const PHONE_ROW = "flex items-center gap-3 px-4 py-3 text-ink no-underline";

/** One row of a PhoneList. With href the whole row opens the record. */
export function PhoneRow({ href, lead, title, sub, end }: PhoneRowProps) {
  const body = (
    <>
      {lead}
      <div className="min-w-0 flex-1">
        <p className="break-words text-[.9rem] font-semibold">{title}</p>
        {sub ? <div className="break-words text-[.8rem] text-muted">{sub}</div> : null}
      </div>
      {end}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className={cx(PHONE_ROW, "transition-colors duration-150 hover:bg-sunken focus-visible:outline-offset-[-2px]")}>
          {body}
        </Link>
      ) : (
        <div className={PHONE_ROW}>{body}</div>
      )}
    </li>
  );
}

type NameCellProps = {
  /** The person or business, for the logo. */
  logoName: string;
  logoSeed?: string;
  /** The name as shown: text, or a link. */
  name: ReactNode;
  sub?: ReactNode;
};

/** A table cell with a small logo, the name in bold and one muted line under it. */
export function NameCell({ logoName, logoSeed, name, sub }: NameCellProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <BusinessLogo name={logoName} seedKey={logoSeed} size={28} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{name}</span>
        {sub ? <span className="block truncate text-[.78rem] text-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

/** A plain link inside a table cell, such as a buyer's name. */
export function CellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-ink no-underline hover:underline">
      {children}
    </Link>
  );
}

/** Makes a whole table row select it (Row must be relative), without jumping to the top of the page. */
export function SelectRowLink({ href, selected, children }: { href: string; selected: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className="font-semibold text-ink no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
    >
      {children}
    </Link>
  );
}

type FilterSelectProps = Omit<ComponentPropsWithoutRef<"select">, "className"> & { label: string };

/** A compact select for a filter bar: the label sits inside the control, as "Outcome  All outcomes". */
export function FilterSelect({ label, children, ...select }: FilterSelectProps) {
  return (
    <label className="inline-flex min-h-9 max-w-full min-w-0 items-center gap-1.5 rounded-lg border border-line bg-surface pr-1.5 pl-3 text-[.84rem]">
      <span className="flex-none text-muted">{label}</span>
      <select {...select} className="min-w-0 max-w-[15rem] truncate rounded-md bg-transparent py-1 font-semibold text-ink">
        {children}
      </select>
    </label>
  );
}
