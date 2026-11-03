import type { ReactNode } from "react";

export type Metric = {
  label: string;
  value: ReactNode;
};

type MetricsProps = {
  items: Metric[];
};

export function Metrics({ items }: MetricsProps) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(56px,1fr))] gap-x-3 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[.75rem] text-muted">{item.label}</dt>
          <dd className="break-words text-[.95rem] font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
