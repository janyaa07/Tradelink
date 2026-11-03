import type { ReactNode } from "react";

export type Tile = {
  label: string;
  value: ReactNode;
  alert?: boolean;
};

type TilesProps = {
  items: Tile[];
};

/** Small value tiles, two across on phone and four from 620px. */
export function Tiles({ items }: TilesProps) {
  return (
    <dl className="grid grid-cols-2 gap-2.5 min-[620px]:grid-cols-4">
      {items.map((tile) => (
        <div
          key={tile.label}
          className="flex min-w-0 flex-col-reverse rounded-lg border border-line bg-surface px-3 py-2.5 shadow-card"
        >
          <dt className="text-muted">
            {tile.label}
            {tile.alert ? <span className="sr-only">, needs attention</span> : null}
          </dt>
          <dd className={`text-2xl font-bold leading-[1.2] tabular-nums ${tile.alert ? "text-warn" : ""}`}>
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
