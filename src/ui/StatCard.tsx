import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

type StatCardProps = {
  href: string;
  value: ReactNode;
  label: string;
  /** Only when the number needs action. */
  alert?: boolean;
};

export function StatCard({ href, value, label, alert = false }: StatCardProps) {
  return (
    <Link
      href={href}
      className="block min-w-0 rounded-lg border border-line bg-surface px-[13px] py-[11px] text-ink no-underline shadow-card transition-colors duration-150 hover:border-accent"
    >
      <b
        className={`block break-words text-[1.3rem] font-bold leading-[1.2] tracking-[-0.015em] tabular-nums ${alert ? "text-warn" : ""}`}
      >
        {value}
      </b>
      <span className="flex items-center gap-1 text-[.8rem] text-muted">
        {alert ? <Icon name="flag" size={13} className="text-warn" /> : null}
        {label}
        {alert ? <span className="sr-only">, needs attention</span> : null}
      </span>
    </Link>
  );
}

type StatGridProps = {
  label?: string;
  children: ReactNode;
};

/** Two across on phone, four from 620px. */
export function StatGrid({ label = "Summary", children }: StatGridProps) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-2.5 min-[620px]:grid-cols-4">
      {children}
    </section>
  );
}
