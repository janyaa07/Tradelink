"use client";

import { useId, useState } from "react";
import { belowMinimumText, type TopUpOption } from "@/domain/minimum";
import { formatMoney, type Cents } from "@/domain/money";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";

type Props = {
  supplierName: string;
  minimumCents: Cents;
  gapCents: Cents;
  options: TopUpOption[];
  onAdd: (option: TopUpOption) => void;
};

/** Under a supplier's lines when its part of the cart is below the minimum. Never blocks placing (BUY-24). */
export function BelowMinimum({ supplierName, minimumCents, gapCents, options, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-warn-soft/60 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-1 items-center gap-2 text-[.84rem] font-semibold text-warn">
          <Icon name="flag" size={15} className="flex-none" />
          {belowMinimumText(supplierName, minimumCents, gapCents)}
        </p>
        {options.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={listId}
            className="border-0 bg-transparent p-0 text-[.84rem] font-semibold text-accent hover:underline"
          >
            {open ? "Hide items" : "Add items"}
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          aria-label={`Usual items from ${supplierName}`}
          className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface"
        >
          {options.map((option) => (
            <li key={option.productId} className="flex items-center gap-3 px-3 py-2 text-[.84rem]">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{option.name}</span>
                <span className="text-muted">
                  {" "}
                  · {option.qty} for {formatMoney(option.totalCents)}
                  {option.totalCents >= gapCents ? ", reaches the minimum" : ""}
                </span>
              </span>
              <Button size="small" onClick={() => onAdd(option)} aria-label={`Add ${option.qty} ${option.name}`}>
                Add
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
