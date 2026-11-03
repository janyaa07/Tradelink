import Link from "next/link";
import type { ReactNode } from "react";
import { Metrics, type Metric } from "./Metrics";

type RecordCardProps = {
  /** A BusinessLogo or ProductArt. */
  lead?: ReactNode;
  title: ReactNode;
  titleHref?: string;
  sub?: ReactNode;
  /** A Pill with the record's state. */
  pill?: ReactNode;
  metrics?: Metric[];
  /** Extra content between the head and the foot, such as order lines and ProgressSteps. */
  children?: ReactNode;
  note?: ReactNode;
  /** Left side of the foot, such as "3 Nov, 14:05 · S$120.00". */
  footer?: ReactNode;
  actions?: ReactNode;
};

/** The standard record layout: lead, title and status, figures, then actions. */
export function RecordCard({ lead, title, titleHref, sub, pill, metrics, children, note, footer, actions }: RecordCardProps) {
  return (
    <article className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {lead}
          <div className="min-w-0">
            <h3 className="break-words text-[.95rem] font-semibold">
              {titleHref ? (
                <Link href={titleHref} className="text-ink no-underline hover:text-accent">
                  {title}
                </Link>
              ) : (
                title
              )}
            </h3>
            {sub ? <div className="break-words text-[.84rem] text-muted">{sub}</div> : null}
          </div>
        </div>
        {pill}
      </div>
      {metrics && metrics.length > 0 ? <Metrics items={metrics} /> : null}
      {children}
      {note ? <div className="text-[.8rem] text-muted">{note}</div> : null}
      {footer || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[.84rem] text-muted">{footer}</div>
          {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

/** Stacks record cards with the standard gap. */
export function RecordList({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>;
}
