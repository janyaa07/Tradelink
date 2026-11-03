import type { ReactNode } from "react";
import { cx } from "./cx";

type PanelProps = {
  title?: ReactNode;
  /** Shown at the end of the title row, such as a "See all" link or a total. */
  action?: ReactNode;
  /** Rounder corners, for Home. */
  soft?: boolean;
  className?: string;
  children: ReactNode;
};

/** Groups one topic. Use divided rows inside it, not nested cards. */
export function Panel({ title, action, soft = false, className, children }: PanelProps) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col gap-3 border border-line bg-surface shadow-card",
        soft ? "rounded-xl p-5" : "rounded-lg p-4 rail:p-5",
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
