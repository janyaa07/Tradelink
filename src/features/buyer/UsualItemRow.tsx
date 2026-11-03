"use client";

import { useTransition } from "react";
import type { ArtKind } from "@/domain/catalogue";
import { formatDaysLeft } from "@/domain/restock";
import { Button } from "@/ui/Button";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard } from "@/ui/RecordCard";
import { useToast } from "@/ui/Toast";
import { removeUsualItemAction, setUsualItemAction } from "./settings-actions";

export type UsualRow = {
  productId: string;
  name: string;
  art: ArtKind;
  usualQty: number;
  usePerDay: number;
  inShop: number;
  daysLeft: number;
};

type Field = "inShop" | "usePerDay" | "usualQty";

const inputClass =
  "w-[84px] rounded-sm border border-control-line bg-surface px-1.5 py-1 text-right tabular-nums text-ink disabled:opacity-50";

/** One usual item: In your shop and Use per day are editable, Days left is worked out (BUY-46). */
export function UsualItemRow({ row }: { row: UsualRow }) {
  const { show } = useToast();
  const [busy, start] = useTransition();

  const save = (field: Field, raw: string) => {
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(value) || value === row[field]) return;
    start(async () => {
      const result = await setUsualItemAction({
        productId: row.productId,
        usualQty: row.usualQty,
        usePerDay: row.usePerDay,
        inShop: row.inShop,
        [field]: value,
      });
      show(result.ok ? `${row.name} updated.` : result.error);
    });
  };

  const input = (field: Field, label: string, step: string) => (
    <input
      key={`${field}-${row[field]}`}
      type="number"
      inputMode="decimal"
      min={field === "usualQty" ? 1 : 0}
      step={step}
      defaultValue={row[field]}
      disabled={busy}
      aria-label={`${label} for ${row.name}`}
      className={inputClass}
      onBlur={(event) => save(field, event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") save(field, event.currentTarget.value);
      }}
    />
  );

  return (
    <RecordCard
      lead={<ProductArt kind={row.art} size={36} />}
      title={row.name}
      metrics={[
        { label: "In your shop", value: input("inShop", "Amount in your shop", "any") },
        { label: "Use per day", value: input("usePerDay", "Use per day", "any") },
        { label: "Usual order", value: input("usualQty", "Usual order quantity", "1") },
        { label: "Days left", value: formatDaysLeft(row.daysLeft) },
      ]}
      actions={
        <Button
          variant="danger"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const result = await removeUsualItemAction(row.productId);
              show(result.ok ? `${row.name} removed from your usual items.` : result.error);
            })
          }
        >
          Remove<span className="sr-only"> {row.name}</span>
        </Button>
      }
    />
  );
}
