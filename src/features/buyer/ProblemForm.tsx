"use client";

import { useState, useTransition } from "react";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { useToast } from "@/ui/Toast";
import { reportProblemAction } from "./order-actions";
import { ISSUE_TYPE_LABELS, PROBLEM_TYPES, type ProblemType } from "./problem";

type Props = { order: OrderView; onClose: () => void };

function toType(value: string): ProblemType {
  return PROBLEM_TYPES.find((type) => type === value) ?? "short";
}

/** Report a problem: item, what happened, quantity affected and an optional note (BUY-30). */
export function ProblemForm({ order, onClose }: Props) {
  const { show } = useToast();
  const [productId, setProductId] = useState(order.lines[0]?.productId ?? "");
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
    <div className="flex flex-col gap-2.5 rounded-md border border-line bg-sunken p-3">
      <h4 className="text-[.84rem] font-bold">Report a problem</h4>
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
    </div>
  );
}
