"use client";

import { useState, useTransition } from "react";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { useToast } from "@/ui/Toast";
import { reportProblemAction } from "./order-actions";
import { ISSUE_TYPE_LABELS, PROBLEM_TYPES, type ProblemType } from "./problem";

type Props = {
  order: OrderView;
  /** The line to start on, from its Report link. */
  initialProductId?: string;
  onClose: () => void;
};

function toType(value: string): ProblemType {
  return PROBLEM_TYPES.find((type) => type === value) ?? "short";
}

/** Report a problem: item, what happened, quantity affected and an optional note (BUY-30). */
export function ProblemForm({ order, initialProductId, onClose }: Props) {
  const { show } = useToast();
  const [productId, setProductId] = useState(
    order.lines.find((orderLine) => orderLine.productId === initialProductId)?.productId ?? order.lines[0]?.productId ?? "",
  );
  const [type, setType] = useState<ProblemType>("short");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const [sending, startSending] = useTransition();
  const line = order.lines.find((candidate) => candidate.productId === productId);
  const max = line?.qty ?? 1;

  const send = () => {
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount < 1 || amount > max) {
      setError(`Enter a whole number from 1 to ${max}.`);
      return;
    }
    startSending(async () => {
      const result = await reportProblemAction({ orderId: order.id, productId, type, qty: amount, note, key });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      show(`Problem sent to ${order.supplier.name}.`);
      onClose();
    });
  };

  return (
    <section aria-labelledby="report-title" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card rail:p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id="report-title">Report a problem</h2>
        <p className="text-[.84rem] text-muted">{order.supplier.name} gets it at once and answers with a credit, a replacement or an update.</p>
      </div>
      <FieldGrid>
        <SelectField label="Item" value={productId} onChange={(event) => setProductId(event.currentTarget.value)} autoFocus>
          {order.lines.map((orderLine) => (
            <option key={orderLine.id} value={orderLine.productId}>
              {orderLine.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="What happened" value={type} onChange={(event) => setType(toType(event.currentTarget.value))}>
          {PROBLEM_TYPES.map((option) => (
            <option key={option} value={option}>
              {ISSUE_TYPE_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Quantity affected"
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          step={1}
          value={qty}
          onChange={(event) => {
            setQty(event.currentTarget.value);
            setError(null);
          }}
        />
        <TextField label="Note (optional)" value={note} maxLength={500} onChange={(event) => setNote(event.currentTarget.value)} />
      </FieldGrid>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={send} disabled={sending}>
          Send to supplier
        </Button>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
