import type { ReactNode } from "react";

export type Tile = {
  label: string;
  value: ReactNode;
  alert?: boolean;
};

type TilesProps = {
  items: Tile[];
};

/** Key figures in one card, divided: two across on phone and four from 620px. */
export function Tiles({ items }: TilesProps) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface shadow-card min-[620px]:grid-cols-4">
      {items.map((tile, index) => (
        <div
          key={tile.label}
          className={`flex min-w-0 flex-col gap-1 border-line px-4 py-3.5 ${index % 2 === 1 ? "border-l" : ""} ${index >= 2 ? "border-t min-[620px]:border-t-0" : ""} ${index === 2 ? "min-[620px]:border-l" : ""}`}
        >
          <dt className="text-[.8rem] font-medium text-muted">
            {tile.label}
            {tile.alert ? <span className="sr-only">, needs attention</span> : null}
          </dt>
          <dd className={`text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.02em] tabular-nums ${tile.alert ? "text-warn" : ""}`}>
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
