import type { ReactNode } from "react";
import { cx } from "./cx";

type PanelProps = {
  title?: ReactNode;
  /** Shown at the end of the title row, such as a "See all" link or a total. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Groups one topic. Use divided rows inside it, not nested cards. */
export function Panel({ title, action, className, children }: PanelProps) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-card",
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {title ? <h2>{title}</h2> : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
