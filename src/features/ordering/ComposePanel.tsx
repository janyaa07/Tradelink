"use client";

import { useId } from "react";
import { Button } from "@/ui/Button";
import { controlClass } from "@/ui/Field";
import { cx } from "@/ui/cx";

const MAX_ORDER_TEXT = 4000;
const COUNTER_FROM = 3600;

type Props = {
  text: string;
  reading: boolean;
  onText: (text: string) => void;
  onRead: () => void;
  onUseUsual: () => void;
  onManual: () => void;
};

/** "Type or paste your order" with Read my order, Use my usual and Add items manually (BUY-10). */
export function ComposePanel({ text, reading, onText, onRead, onUseUsual, onManual }: Props) {
  const id = useId();
  const counterId = `${id}-count`;
  const nearLimit = text.length >= COUNTER_FROM;
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-lg border border-line bg-surface p-3.5 shadow-card">
      <label htmlFor={id}>
        <h2>Type or paste your order</h2>
      </label>
      <textarea
        id={id}
        value={text}
        maxLength={MAX_ORDER_TEXT}
        spellCheck={false}
        onChange={(event) => onText(event.currentTarget.value)}
        aria-describedby={nearLimit ? counterId : undefined}
        placeholder={"10 bags jasmine rice\n4 tins condensed milk"}
        className={cx(controlClass, "min-h-[150px] resize-y bg-sunken p-2.5 font-mono leading-normal")}
      />
      {nearLimit ? (
        <p id={counterId} className="text-[.8rem] text-muted" aria-live="polite">
          {text.length.toLocaleString("en-SG")} of {MAX_ORDER_TEXT.toLocaleString("en-SG")} characters
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="flex-[1_1_170px]" onClick={onRead} disabled={reading} aria-busy={reading || undefined}>
          {reading ? "Reading your order..." : "Read my order"}
        </Button>
        <Button onClick={onUseUsual}>Use my usual</Button>
        <Button onClick={onManual}>Add items manually</Button>
      </div>
    </section>
  );
}
