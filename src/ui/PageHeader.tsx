import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";
import type { PillTone } from "./Pill";

type PageHeaderProps = {
  title: ReactNode;
  /** One sentence on what the page is for. */
  description?: ReactNode;
  /** Search and buttons, right-aligned on a laptop. */
  actions?: ReactNode;
};

/** The top of every list page: title, one line of help and the page's own actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 rail:flex-row rail:items-end rail:justify-between">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1>{title}</h1>
        {description ? <p className="text-[.9rem] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export type FilterTab = {
  href: string;
  label: string;
  count?: number;
  current: boolean;
};

/** Segmented filters with a count on each; scrolls sideways on a phone instead of wrapping. */
export function FilterTabs({ label, tabs }: { label: string; tabs: FilterTab[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] rail:mx-0 rail:px-0">
      <div className="inline-flex gap-0.5 rounded-[10px] bg-sunken p-[3px]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            scroll={false}
            aria-current={tab.current ? "page" : undefined}
            className={cx(
              "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-[5px] text-[.84rem] font-semibold no-underline transition-colors duration-150",
              tab.current ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? <span className={cx("num font-medium", tab.current ? "text-muted" : "opacity-75")}>{tab.count}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}

type SearchBoxProps = {
  /** Where the GET form goes, such as /buyer/orders. */
  action: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  /** Other query values to keep, such as the current filter. */
  keep?: Record<string, string | undefined>;
};

/** A search field that submits as ?q= to the page it is on. */
export function SearchBox({ action, label, placeholder, defaultValue, keep = {} }: SearchBoxProps) {
  return (
    <Form action={action} role="search" className="relative w-full rail:w-72">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label className="sr-only" htmlFor={`search${action.replaceAll("/", "-")}`}>
        {label}
      </label>
      <Icon name="search" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        key={defaultValue}
        id={`search${action.replaceAll("/", "-")}`}
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={60}
        placeholder={placeholder}
        className="min-h-9 w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-9 text-[.875rem] text-ink placeholder:text-muted"
      />
      <button type="submit" className="sr-only">
        Search
      </button>
    </Form>
  );
}

const NOTICE_TONES: Record<Exclude<PillTone, "plain">, string> = {
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  good: "bg-good-soft text-good",
};

type NoticeProps = {
  tone: Exclude<PillTone, "plain">;
  /** The bold first words. */
  title: ReactNode;
  children?: ReactNode;
  href?: string;
  /** The link's words, such as View. */
  action?: string;
};

/** One line that needs attention above a list, such as a problem waiting for the supplier. */
export function Notice({ tone, title, children, href, action = "View" }: NoticeProps) {
  const body = (
    <>
      <Icon name="flag" size={16} className="flex-none" />
      <span className="min-w-0 flex-1 text-[.84rem]">
        <b className="font-semibold">{title}</b>
        {children ? <span className="text-ink/80"> {children}</span> : null}
      </span>
      {href ? <span className="flex-none text-[.84rem] font-semibold">{action}</span> : null}
    </>
  );
  const className = cx("flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 no-underline", NOTICE_TONES[tone]);
  return href ? (
    <Link href={href} className={cx(className, "hover:brightness-[0.98]")}>
      {body}
    </Link>
  ) : (
    <p className={className}>{body}</p>
  );
}
