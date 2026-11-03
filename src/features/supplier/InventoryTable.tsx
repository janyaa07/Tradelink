"use client";

import { useState, type ReactNode } from "react";
import type { CatalogueItem, Health } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { LevelBar } from "@/features/home/HomeParts";
import { Button } from "@/ui/Button";
import { Cell, DataTable, Row, type Column } from "@/ui/DataTable";
import { Icon } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { AdjustForm, ConfirmForm, PriceForm, ReceiveForm, type Mode } from "./StockForms";
import { HEALTH_PILL, stockBarPercent } from "./stock";

/** A product with the idempotency key its stock forms send. */
export type InventoryTableRow = { item: CatalogueItem; idemKey: string };

const COLUMNS: Column[] = [
  { label: "Product" },
  { label: "Price", align: "right", className: "w-24" },
  { label: "On hand", align: "right", className: "w-24" },
  { label: "Reserved", align: "right", className: "w-24" },
  { label: "Available", className: "w-40" },
  { label: "Reorder at", align: "right", className: "w-24" },
  { label: "Status", className: "w-36" },
  { label: "Actions", hidden: true },
];

const LEVEL_TONE: Record<Health, "plain" | "warn" | "bad"> = { healthy: "plain", low: "warn", out: "bad", unconfirmed: "plain" };

/**
 * A product as a table row (SUP-10 to SUP-15). Low and out-of-stock products show Receive stock, products a
 * buyer added show Confirm stock, and the more button opens the other actions below the row.
 */
function InventoryRow({ item, idemKey }: InventoryTableRow) {
  const [mode, setMode] = useState<Mode | "menu" | null>(null);
  const unconfirmed = item.status === "unconfirmed";
  const pill = HEALTH_PILL[item.health];
  const percent = stockBarPercent(item);
  const close = () => setMode(null);
  const formProps = { item, idemKey, onClose: close };

  let quick: ReactNode = null;
  if (unconfirmed) {
    quick = (
      <Button size="small" variant="primary" onClick={() => setMode("confirm")}>
        Confirm stock
      </Button>
    );
  } else if (item.health === "low" || item.health === "out") {
    quick = (
      <Button size="small" onClick={() => setMode("receive")}>
        Receive stock
      </Button>
    );
  }

  return (
    <>
      <Row selected={mode !== null}>
        <Cell>
          <b className="block font-semibold">{item.name}</b>
          <span className="num text-[.75rem] text-muted">
            {item.sku} · {item.unit}
          </span>
        </Cell>
        <Cell num align="right">
          {formatMoney(item.price)}
        </Cell>
        <Cell num align="right">
          {item.onHand}
        </Cell>
        <Cell num align="right" muted>
          {item.reserved}
        </Cell>
        <Cell num>
          {percent === null ? (
            <span className="text-muted">To confirm</span>
          ) : (
            <span className="flex items-center gap-2.5">
              <b className="w-9 font-semibold">{item.available}</b>
              <span className="w-20">
                <LevelBar percent={percent} tone={LEVEL_TONE[item.health]} />
              </span>
            </span>
          )}
        </Cell>
        <Cell num align="right">
          {item.reorderLevel}
        </Cell>
        <Cell>
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </Cell>
        <Cell align="right">
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {mode === null ? quick : null}
            <button
              type="button"
              aria-label={`More actions for ${item.name}`}
              aria-expanded={mode === "menu"}
              onClick={() => setMode(mode === "menu" ? null : "menu")}
              className="grid size-8 flex-none place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Icon name="more" size={18} />
            </button>
          </div>
        </Cell>
      </Row>
      {mode ? (
        <tr>
          <td colSpan={COLUMNS.length} className="border-b border-line/70 px-3.5 pt-1 pb-3">
            {mode === "menu" ? (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {unconfirmed ? (
                  <Button size="small" onClick={() => setMode("confirm")}>
                    Confirm stock
                  </Button>
                ) : (
                  <Button size="small" onClick={() => setMode("receive")}>
                    Receive stock
                  </Button>
                )}
                <Button size="small" onClick={() => setMode("price")}>
                  Change price
                </Button>
                {unconfirmed ? null : (
                  <Button size="small" onClick={() => setMode("adjust")}>
                    Adjust stock
                  </Button>
                )}
                <Button size="small" className="border-transparent text-muted" onClick={close}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="ml-auto max-w-xl">
                {mode === "receive" ? <ReceiveForm {...formProps} /> : null}
                {mode === "confirm" ? <ConfirmForm {...formProps} /> : null}
                {mode === "price" ? <PriceForm {...formProps} /> : null}
                {mode === "adjust" ? <AdjustForm {...formProps} /> : null}
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

/** Inventory as a table on a laptop; the phone shows the product cards. */
export function InventoryTable({ rows, phone }: { rows: InventoryTableRow[]; phone: ReactNode }) {
  return (
    <DataTable label="Products" columns={COLUMNS} phone={phone}>
      {rows.map((row) => (
        <InventoryRow key={row.item.id} item={row.item} idemKey={row.idemKey} />
      ))}
    </DataTable>
  );
}
