"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { formatMoney, type Cents } from "@/domain/money";
import { StatusPill } from "@/features/orders/OrderCard";
import type { OrderView } from "@/features/orders/queries";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { Cell, CellActions, DataTable, Row, RowLink, type Column } from "@/ui/DataTable";
import { orderNumber } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { Pill } from "@/ui/Pill";
import { useToast } from "@/ui/Toast";
import { AcceptForm, PartAcceptForm } from "./AcceptForms";
import { orderBelowMinimum } from "./minimum";
import { markAllOutForDeliveryAction, markDeliveredAction, markOutForDeliveryAction } from "./orderActions";
import { deliveryDateOf, deliveryLabel, linesSummary } from "./orderFilters";
import { useSupplierForm } from "./useSupplierForm";

/** One order with the idempotency key its forms send and the delivery date Accept starts with. */
export type OrderTableRow = { order: OrderView; idemKey: string; defaultDate: string };

/** markAllOutForDeliveryAction takes up to 30 orders at a time. */
const MAX_SEND_OUT = 30;

/** Ticking orders to send out together only helps when there are at least two. */
const MIN_SEND_TOGETHER = 2;

const checkboxClass = "size-4 cursor-pointer accent-accent";

type RowProps = {
  row: OrderTableRow;
  today: string;
  columnCount: number;
  /** The supplier's current minimum order. */
  minimumCents: Cents;
  /** Null when the table has no selection column. */
  picked: boolean | null;
  onPick: () => void;
};

/**
 * An order as a table row with the supplier's actions for its state; Accept and Part accept open across
 * the full row below it (SUP-03 to SUP-07). The whole row opens the order page.
 */
function OrderRow({ row, today, columnCount, minimumCents, picked, onPick }: RowProps) {
  const { order, idemKey, defaultDate } = row;
  const [open, setOpen] = useState<"accept" | "part" | null>(null);
  const advance = useSupplierForm(order.status === "accepted" ? markOutForDeliveryAction : markDeliveredAction);
  const blockedId = useId();
  const ref = orderNumber(order.number);
  const unconfirmed = order.lines.filter((line) => !line.held && line.productUnconfirmed).map((line) => line.name);
  const blocked = order.status === "pending" && unconfirmed.length > 0;
  const toConfirm = order.lines.some((line) => !line.held);
  const summary = linesSummary(order.lines);
  const error = advance.error;
  const belowMinimum = orderBelowMinimum(order, minimumCents) > 0;
  const close = () => setOpen(null);
  const hidden = (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );

  const advanceLabel = order.status === "accepted" ? "Mark out for delivery" : "Mark delivered";
  let actions = null;
  if (order.status === "pending" && open === null) {
    actions = (
      <>
        <Button
          variant="primary"
          size="small"
          disabled={blocked}
          aria-describedby={blocked ? blockedId : undefined}
          onClick={() => setOpen("accept")}
          aria-label={`Accept order, ${ref}`}
        >
          Accept order
        </Button>
        <Button size="small" onClick={() => setOpen("part")} aria-label={`Part accept, ${ref}`}>
          Part accept
        </Button>
      </>
    );
  } else if (order.status === "accepted" || order.status === "out_for_delivery") {
    actions = (
      <form onSubmit={advance.onSubmit}>
        {hidden}
        <Button type="submit" size="small" disabled={advance.pending} aria-label={`${advanceLabel}, ${ref}`}>
          {advanceLabel}
        </Button>
      </form>
    );
  }

  return (
    <>
      <Row selected={picked === true || open !== null}>
        {picked === null ? null : (
          <Cell>
            {order.status === "accepted" ? (
              <span className="relative z-[1] flex">
                <input type="checkbox" className={checkboxClass} checked={picked} onChange={onPick} aria-label={`Send out ${ref}`} />
              </span>
            ) : null}
          </Cell>
        )}
        <Cell num strong>
          <span data-anchor={`order-${order.number}`} className="-mx-1 scroll-mt-24 rounded px-1 data-hit:bg-accent-soft data-hit:text-accent">
            <RowLink href={`/supplier/orders/${order.id}`}>{ref}</RowLink>
          </span>
        </Cell>
        <Cell>
          <span className="flex items-center gap-2.5">
            <BusinessLogo name={order.buyer.name} seedKey={order.buyer.id || undefined} size={24} />
            <span className="max-w-[8.5rem] truncate">{order.buyer.name}</span>
          </span>
        </Cell>
        <Cell muted>
          <span className="block max-w-[8rem] truncate" title={summary}>
            {summary}
          </span>
          {blocked ? (
            <span id={blockedId} className="block text-[.78rem] font-semibold text-warn">
              Confirm stock for {unconfirmed.join(", ")} first
            </span>
          ) : toConfirm ? (
            <span className="block text-[.78rem] font-semibold text-warn">Stock and price to confirm</span>
          ) : null}
        </Cell>
        <Cell num>{deliveryLabel(deliveryDateOf(order), today)}</Cell>
        <Cell num strong align="right">
          {formatMoney(order.totalCents)}
        </Cell>
        <Cell>
          <span className="flex flex-wrap items-center gap-1">
            <StatusPill status={order.status} />
            {order.checkStatus === "all_here" ? <Pill tone="good">All here</Pill> : null}
            {order.checkStatus === "problem" ? <Pill tone="warn">Problem reported</Pill> : null}
            {belowMinimum ? <Pill tone="warn">Below minimum</Pill> : null}
          </span>
        </Cell>
        <Cell align="right">
          {actions ? (
            <CellActions>
              <span className="flex items-center gap-1.5 whitespace-nowrap">{actions}</span>
            </CellActions>
          ) : null}
        </Cell>
      </Row>
      {open || error ? (
        <tr>
          <td colSpan={columnCount} className="border-b border-line/70 px-3.5 pt-1 pb-3">
            <div className="flex w-full flex-col gap-2">
              {open === "accept" ? <AcceptForm order={order} idemKey={idemKey} minDate={today} defaultDate={defaultDate} onClose={close} /> : null}
              {open === "part" ? <PartAcceptForm order={order} idemKey={idemKey} minDate={today} defaultDate={defaultDate} onClose={close} /> : null}
              <FormError>{error}</FormError>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

type TableProps = {
  rows: OrderTableRow[];
  /** Today in Singapore, as "2026-11-04". */
  today: string;
  /** Tick every order that is ready to go out, as on the To pack tab. */
  pickAll: boolean;
  /** A line under the table, such as how many orders are shown. */
  note?: string;
  /** The supplier's current minimum order; orders under it get a Below minimum pill. */
  minimumCents: Cents;
  /** The phone version: the order cards. */
  phone: ReactNode;
};

/**
 * Orders as a table on a laptop. When two or more orders are ready to go out, a Send out column and
 * the footer let the supplier tick them and mark them out for delivery together.
 */
export function SupplierOrderTable({ rows, today, pickAll, note, minimumCents, phone }: TableProps) {
  const toast = useToast();
  const ready = rows.filter((row) => row.order.status === "accepted");
  const selectable = ready.length >= MIN_SEND_TOGETHER;
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(pickAll && selectable ? ready.map((row) => row.order.id) : []));
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selected = ready.filter((row) => picked.has(row.order.id));
  const allPicked = selectable && selected.length === ready.length;
  const tooMany = selected.length > MAX_SEND_OUT;

  const columns: Column[] = [
    ...(selectable ? [{ label: "Send", className: "w-14" }] : []),
    { label: "Order", className: "w-24" },
    { label: "Buyer" },
    { label: "Items" },
    { label: "Delivery", className: "w-28" },
    { label: "Total", align: "right", className: "w-24" },
    { label: "Status", className: "w-32" },
    { label: "Actions", hidden: true },
  ];

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sendOut = () =>
    startSending(async () => {
      setError(null);
      const result = await markAllOutForDeliveryAction(selected.map((row) => ({ orderId: row.order.id, key: row.idemKey })));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show(result.message);
      setPicked(new Set());
    });

  const footer = selectable ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {note ? <p className="w-full">{note}</p> : null}
      <label className="flex cursor-pointer items-center gap-2 font-semibold text-ink">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={allPicked}
          onChange={() => setPicked(allPicked ? new Set() : new Set(ready.map((row) => row.order.id)))}
        />
        Select all {ready.length} ready to go out
      </label>
      <span>
        <b className="font-semibold text-ink">{selected.length} selected</b> ·{" "}
        {formatMoney(selected.reduce((total, row) => total + row.order.totalCents, 0))}
      </span>
      <span className="flex-1" />
      {tooMany ? <span className="font-semibold text-warn">Choose up to {MAX_SEND_OUT} at a time.</span> : null}
      <FormError>{error}</FormError>
      <Button variant="primary" size="small" disabled={sending || selected.length === 0 || tooMany} onClick={sendOut}>
        {sending ? "Sending..." : selected.length > 0 ? `Mark ${selected.length} out for delivery` : "Mark out for delivery"}
      </Button>
    </div>
  ) : (
    note
  );

  return (
    <DataTable label="Orders" columns={columns} footer={footer} phone={phone}>
      {rows.map((row) => (
        <OrderRow
          key={row.order.id}
          row={row}
          today={today}
          columnCount={columns.length}
          minimumCents={minimumCents}
          picked={selectable ? picked.has(row.order.id) : null}
          onPick={() => toggle(row.order.id)}
        />
      ))}
    </DataTable>
  );
}
