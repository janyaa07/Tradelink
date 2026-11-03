"use client";

import { useState } from "react";
import { MAX_LINE_QTY, wholeQuantity } from "@/domain/review";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Names the product, so each stepper is distinct for screen readers. */
  productLabel: string;
};

/** Quantity stepper: "-" never goes below 1; typed values that are not whole numbers above 0 become 1 (BUY-15). */
export function Stepper({ value, onChange, productLabel }: Props) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(String(value));
  }
  const commit = (raw: string) => {
    const next = wholeQuantity(raw);
    setText(String(next));
    if (next !== value) onChange(next);
  };
  const buttonClass = "w-[34px] border-0 bg-sunken text-[1.05rem] font-semibold text-ink disabled:cursor-not-allowed disabled:text-muted";
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-line">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        aria-label={`Reduce quantity of ${productLabel}`}
      >
        <span aria-hidden="true">-</span>
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_LINE_QTY}
        step={1}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        aria-label={`Quantity of ${productLabel}`}
        onBlur={(event) => commit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
        className="w-[52px] border-0 bg-transparent py-1.5 text-center tabular-nums text-ink [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(Math.min(MAX_LINE_QTY, value + 1))}
        disabled={value >= MAX_LINE_QTY}
        aria-label={`Increase quantity of ${productLabel}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
