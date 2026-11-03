"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ArtKind } from "@/domain/catalogue";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { useToast } from "@/ui/Toast";
import { removeUsualItemAction, setUsualItemAction } from "./settings-actions";
import { daysLabel, daysTone, liveDaysLeft } from "./usual-days";

export type UsualRow = {
  productId: string;
  name: string;
  supplierName: string;
  art: ArtKind;
  usualQty: number;
  usePerDay: number;
  inShop: number;
  /** Stock already ordered and not yet checked in; it counts towards days left. */
  onOrder: number;
};

type Field = "usualQty" | "inShop" | "usePerDay";

const FIELDS: { key: Field; label: string; step: string; min: number }[] = [
  { key: "usualQty", label: "Usual order", step: "1", min: 1 },
  { key: "inShop", label: "In your shop", step: "any", min: 0 },
  { key: "usePerDay", label: "Use per day", step: "any", min: 0 },
];

/** Phone: picture, name and days left, then the three fields, then the buttons. From 860px: one aligned row. */
const ROW_COLS =
  "grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 @min-[860px]:grid-cols-[42px_minmax(0,1fr)_repeat(3,88px)_112px_160px]";

const inputClass =
  "w-full min-w-0 rounded-md border border-control-line bg-surface px-2 py-1.5 text-right tabular-nums text-ink disabled:opacity-50 aria-invalid:border-bad";

type Values = Record<Field, string>;

function valuesOf(row: UsualRow): Values {
  return { usualQty: String(row.usualQty), inShop: String(row.inShop), usePerDay: String(row.usePerDay) };
}

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

/** One usual item with compact inline fields. Saves per row and says so (BUY-46). */
function UsualItemRow({ row }: { row: UsualRow }) {
  const { show } = useToast();
  const [saved, setSaved] = useState<Values>(() => valuesOf(row));
  const [values, setValues] = useState<Values>(saved);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, start] = useTransition();
  const dirty = FIELDS.some((field) => values[field.key] !== saved[field.key]);
  const days = liveDaysLeft(values.inShop, values.usePerDay, row.onOrder);
  const statusId = `usual-status-${row.productId}`;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dirty || busy) return;
    if (FIELDS.some((field) => values[field.key].trim() === "")) {
      setStatus({ kind: "error", message: "Fill in all three numbers." });
      return;
    }
    start(async () => {
      const result = await setUsualItemAction({
        productId: row.productId,
        usualQty: Number(values.usualQty),
        inShop: Number(values.inShop),
        usePerDay: Number(values.usePerDay),
      });
      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }
      setSaved(values);
      setStatus({ kind: "saved" });
    });
  };

  const remove = () =>
    start(async () => {
      const result = await removeUsualItemAction(row.productId);
      show(result.ok ? `${row.name} removed from your usual items.` : result.error);
    });

  return (
    <li className="border-t border-line px-4 py-3 rail:px-[18px]">
      <form onSubmit={save} noValidate aria-label={row.name} className={cx("grid", ROW_COLS)}>
        <span className="order-1">
          <ProductArt kind={row.art} size={42} />
        </span>
        <span className="order-2 min-w-0">
          <b className="block truncate text-[.875rem] font-semibold">{row.name}</b>
          <span className="block truncate text-[.75rem] text-muted">{row.supplierName}</span>
        </span>
        <span className="order-3 justify-self-end @min-[860px]:order-4 @min-[860px]:justify-self-start">
          {days === null ? <Pill>Check numbers</Pill> : <Pill tone={daysTone(days)}>{daysLabel(days)}</Pill>}
        </span>
        <div className="order-4 col-span-full grid grid-cols-3 gap-2 @min-[860px]:contents">
          {FIELDS.map((field) => (
            <label key={field.key} className="flex min-w-0 flex-col gap-1 @min-[860px]:order-3">
              <span className="text-[.75rem] font-medium text-muted @min-[860px]:sr-only">{field.label}</span>
              <input
                type="number"
                inputMode="decimal"
                min={field.min}
                step={field.step}
                value={values[field.key]}
                disabled={busy}
                aria-invalid={status.kind === "error" ? true : undefined}
                aria-describedby={statusId}
                className={inputClass}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setValues((current) => ({ ...current, [field.key]: value }));
                  setStatus({ kind: "idle" });
                }}
              />
            </label>
          ))}
        </div>
        <div className="order-5 col-span-full flex flex-wrap items-center justify-end gap-2 @min-[860px]:col-span-1">
          <span
            id={statusId}
            role="status"
            className={cx("mr-auto text-[.8rem] font-medium @min-[860px]:sr-only", status.kind === "error" ? "text-bad" : "text-good")}
          >
            {status.kind === "saved" ? "Saved" : status.kind === "error" ? status.message : null}
          </span>
          <Button type="submit" size="small" variant={dirty ? "primary" : "default"} disabled={!dirty || busy} className="min-h-0">
            {status.kind === "saved" && !dirty ? "Saved" : "Save"}
            <span className="sr-only"> {row.name}</span>
          </Button>
          <Button size="small" variant="danger" disabled={busy} onClick={remove}>
            Remove<span className="sr-only"> {row.name}</span>
          </Button>
        </div>
      </form>
      {status.kind === "error" ? (
        <p className="mt-1.5 hidden text-right text-[.8rem] text-bad @min-[860px]:block" aria-hidden="true">
          {status.message}
        </p>
      ) : null}
    </li>
  );
}

/** The usual items as one aligned list inside a settings card, with column labels from 860px. */
export function UsualList({ rows }: { rows: UsualRow[] }) {
  return (
    <div className="@container">
      <div>
        <div
          aria-hidden="true"
          className={cx(
            ROW_COLS,
            "hidden border-t border-line bg-[color-mix(in_srgb,var(--color-sunken)_50%,var(--color-surface))] px-[18px] py-2 text-[.72rem] font-semibold text-muted @min-[860px]:grid",
          )}
        >
          <span />
          <span>Item</span>
          <span className="text-right">Usual order</span>
          <span className="text-right">In your shop</span>
          <span className="text-right">Use per day</span>
          <span>Days left</span>
          <span />
        </div>
        <ul>
          {rows.map((row) => (
            <UsualItemRow key={row.productId} row={row} />
          ))}
        </ul>
      </div>
    </div>
  );
}
