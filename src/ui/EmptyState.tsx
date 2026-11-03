import type { ReactNode } from "react";

type EmptyStateProps = {
  /** Say what is true and what to do next. */
  children: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ children, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-[26px] text-center text-muted shadow-card">
      <p>{children}</p>
      {action}
    </div>
  );
}
