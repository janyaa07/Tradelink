"use client";

import { useMemo, useState } from "react";
import type { CardEnvelope, CardState } from "@/cards/envelope";
import { formatMoney } from "@/domain/money";
import { useCardAction } from "@/features/cards/useCardAction";
import { Stepper } from "@/features/ordering/Stepper";
import { Button } from "@/ui/Button";
import { CardActionBar, CardShell } from "@/ui/cards/CardShell";
import { formatDate, formatDateTime } from "@/ui/format";
import { OrderSummaryDataSchema, type OrderSummaryData, type OrderSummaryGroup, type OrderSummaryLine } from "./schema";
import { withQuantities } from "./summary";

type Props = { card: CardEnvelope; onUpdate: (card: CardEnvelope) => void };

/** What the card shows while a tap is applying; dropped once the stored card changes. */
type Optimistic = { at: string; state?: CardState; cancelled?: boolean; quantities?: ReadonlyMap<string, number> };

const NO_QUANTITIES: ReadonlyMap<string, number> = new Map();
const CONFIRM_BUZZ_MS = 15;

function money(cents: number, approx: boolean): string {
  return approx ? `about ${formatMoney(cents)}` : formatMoney(cents);
}

function LineRow({ line, editing, onQty }: { line: OrderSummaryLine; editing: boolean; onQty: (qty: number) => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="[overflow-wrap:anywhere]">{line.itemName}</span>
        <span className="text-[.8rem] text-muted tabular-nums">
          {line.needsPick
            ? "Pick the item and quantity first"
            : `${line.qty ?? ""} ${line.orderUnit ?? ""}${
                line.unitPriceCents === null ? " · price not known yet" : ` × ${money(line.unitPriceCents, line.approx)}`
              }`}
        </span>
      </span>
      {editing && !line.needsPick && line.qty !== null ? (
        <Stepper value={line.qty} onChange={onQty} productLabel={line.itemName} />
      ) : (
        <span className="flex-none tabular-nums">
          {line.lineTotalCents === null ? "–" : money(line.lineTotalCents, line.approx)}
        </span>
      )}
    </li>
  );
}

function SupplierSection({ group, editing, onQty }: { group: OrderSummaryGroup; editing: boolean; onQty: (lineId: string, qty: number) => void }) {
  const details = [
    group.purchaseOrderNumber ? `R-${group.purchaseOrderNumber}` : null,
    group.deliveryDate ? `Delivery ${formatDate(group.deliveryDate)}` : null,
    group.paymentNote,
  ].filter(Boolean);
  return (
    <section className="flex flex-col border-t border-line pt-2.5 first:border-t-0 first:pt-0">
      <div className="flex flex-col">
        <h3 className="font-semibold">{group.supplierName}</h3>
        {details.length > 0 ? <span className="text-[.8rem] text-muted">{details.join(" · ")}</span> : null}
      </div>
      <ul className="divide-y divide-line">
        {group.lines.map((line) => (
          <LineRow key={line.lineId} line={line} editing={editing} onQty={(qty) => onQty(line.lineId, qty)} />
        ))}
      </ul>
      {group.supplierId ? (
        <div className="flex items-center justify-between text-[.88rem]">
          <span className="text-muted">Subtotal</span>
          <span className="tabular-nums">{money(group.subtotalCents, group.approx)}</span>
        </div>
      ) : null}
      {group.belowMinimum && group.minimumOrderCents !== null ? (
        <p className="mt-1 rounded-md bg-warn-soft px-2.5 py-1.5 text-[.82rem] text-warn">
          {formatMoney(group.minimumOrderCents - group.subtotalCents)} below the {formatMoney(group.minimumOrderCents)} minimum
          order for {group.supplierName}.
        </p>
      ) : null}
    </section>
  );
}

function Totals({ data }: { data: OrderSummaryData }) {
  const notes = [
    data.unknownPriceCount > 0
      ? `Leaves out ${data.unknownPriceCount} ${data.unknownPriceCount === 1 ? "item" : "items"} with no price yet.`
      : null,
    data.approx ? "Weighed items are estimates until delivery." : null,
    data.skippedCount > 0 ? `${data.skippedCount} skipped ${data.skippedCount === 1 ? "line is" : "lines are"} not shown.` : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-2.5">
      <div className="flex items-center justify-between font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{money(data.totalCents, data.approx)}</span>
      </div>
      {notes.map((note) => (
        <p key={note} className="text-[.8rem] text-muted">
          {note}
        </p>
      ))}
    </div>
  );
}

function OrderSummaryBody({ card, data, onUpdate }: Props & { data: OrderSummaryData }) {
  const { pending, act, saveFields } = useCardAction(card, onUpdate);
  const [draft, setDraft] = useState<Map<string, number> | null>(null);
  const [optimistic, setOptimistic] = useState<Optimistic | null>(null);

  const current = optimistic?.at === card.updatedAt ? optimistic : null;
  const quantities = draft ?? current?.quantities ?? NO_QUANTITIES;
  const shown = useMemo(() => (quantities.size > 0 ? withQuantities(data, quantities) : data), [data, quantities]);
  const editing = draft !== null;
  const cancelled = current?.cancelled === true || data.orderState === "CANCELLED";

  const tryOptimistic = async (next: Omit<Optimistic, "at">, send: () => Promise<boolean>) => {
    setOptimistic({ ...next, at: card.updatedAt });
    if (!(await send())) setOptimistic(null);
  };

  const onAction = (id: string) => {
    if (id === "edit") {
      setDraft(new Map());
      return;
    }
    if (id === "confirm") {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(CONFIRM_BUZZ_MS);
      void tryOptimistic({ state: "confirmed" }, () => act("confirm"));
      return;
    }
    if (id === "cancel") void tryOptimistic({ state: "done", cancelled: true }, () => act("cancel"));
  };

  const saveEdits = () => {
    const before = new Map(data.groups.flatMap((group) => group.lines.map((line) => [line.lineId, line.qty] as const)));
    const changes = [...(draft ?? NO_QUANTITIES)]
      .filter(([lineId, qty]) => before.get(lineId) !== qty)
      .map(([lineId, qty]) => ({ lineId, qty }));
    const edited = draft ?? NO_QUANTITIES;
    setDraft(null);
    if (changes.length > 0) void tryOptimistic({ quantities: edited }, () => saveFields(changes));
  };

  const footerActions = editing ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" className="flex-1" onClick={saveEdits}>
        Save changes
      </Button>
      <Button onClick={() => setDraft(null)}>Discard changes</Button>
    </div>
  ) : (
    <CardActionBar actions={card.actions} onAction={onAction} pending={pending} disabled={current !== null} />
  );

  return (
    <CardShell
      card={card}
      title="Order summary"
      subjectLabel={`Order of ${formatDateTime(data.createdAt)}`}
      state={current?.state}
      stateLabel={cancelled ? "Cancelled" : undefined}
      footerActions={footerActions}
    >
      {shown.groups.length === 0 ? <p className="text-muted">This order has no lines.</p> : null}
      {shown.groups.map((group) => (
        <SupplierSection
          key={group.supplierId ?? "needs-pick"}
          group={group}
          editing={editing}
          onQty={(lineId, qty) => setDraft((prev) => new Map(prev ?? []).set(lineId, qty))}
        />
      ))}
      {shown.needsPickCount > 0 ? (
        <p className="text-[.82rem] text-warn">Every line needs an item you chose and a quantity before you can confirm.</p>
      ) : null}
      <Totals data={shown} />
    </CardShell>
  );
}

/** The order summary card: supplier sections, inline quantity edits, totals and Confirm, Edit, Cancel. */
export function OrderSummaryCard({ card, onUpdate }: Props) {
  const parsed = useMemo(() => OrderSummaryDataSchema.safeParse(card.data), [card.data]);
  if (!parsed.success) {
    return (
      <CardShell card={card} title="Order summary">
        <p className="text-muted">This card could not be shown. Refresh to try again.</p>
      </CardShell>
    );
  }
  return <OrderSummaryBody card={card} data={parsed.data} onUpdate={onUpdate} />;
}
