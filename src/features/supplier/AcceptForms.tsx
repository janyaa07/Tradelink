"use client";

import { useId, type ReactNode } from "react";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { acceptOrderAction, partAcceptOrderAction } from "./orderActions";
import { checkPartQuantities } from "./product";
import { useSupplierForm } from "./useSupplierForm";

type Props = {
  order: OrderView;
  idemKey: string;
  minDate: string;
  defaultDate: string;
  onClose: () => void;
};

const formClass = "flex w-full flex-col gap-2.5 rounded-md border border-line bg-sunken p-3";

/** Quantity fields keep their width when the form is wide, such as across a table row. */
const linesClass = "grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5";

function Hidden({ order, idemKey }: Pick<Props, "order" | "idemKey">) {
  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );
}

/** The delivery date with the form's buttons beside it. */
function DateAndButtons({ minDate, defaultDate, children }: Pick<Props, "minDate" | "defaultDate"> & { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="w-full max-w-48">
        <TextField label="Delivery date" name="date" type="date" min={minDate} defaultValue={defaultDate} />
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** Accept order with the confirmed delivery date (SUP-04). */
export function AcceptForm({ order, idemKey, minDate, defaultDate, onClose }: Props) {
  const errorId = useId();
  const { onSubmit, error, pending } = useSupplierForm(acceptOrderAction, { onSuccess: onClose });
  return (
    <form onSubmit={onSubmit} className={formClass} aria-describedby={error ? errorId : undefined} noValidate>
      <Hidden order={order} idemKey={idemKey} />
      <DateAndButtons minDate={minDate} defaultDate={defaultDate}>
        <Button type="submit" variant="primary" disabled={pending}>
          Accept order
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DateAndButtons>
      <FormError id={errorId}>{error}</FormError>
    </form>
  );
}

/** "How much can you send?" with a field per line from 0 to the ordered quantity (SUP-05). */
export function PartAcceptForm({ order, idemKey, minDate, defaultDate, onClose }: Props) {
  const errorId = useId();
  const lines = order.lines.map((line) => ({ productId: line.productId, name: line.name, qty: line.qty }));
  const check = (form: FormData) => {
    const values = Object.fromEntries(lines.map((line) => [line.productId, String(form.get(`send:${line.productId}`) ?? "")]));
    const result = checkPartQuantities(lines, values);
    return result.ok ? null : result.error;
  };
  const { onSubmit, error, pending } = useSupplierForm(partAcceptOrderAction, { check, onSuccess: onClose });
  const headingId = `${errorId}-heading`;

  return (
    <form onSubmit={onSubmit} className={formClass} aria-labelledby={headingId} aria-describedby={error ? errorId : undefined} noValidate>
      <h4 id={headingId} className="text-[.84rem] font-bold">
        How much can you send?
      </h4>
      <Hidden order={order} idemKey={idemKey} />
      <div className={linesClass}>
        {lines.map((line) => (
          <div key={line.productId}>
            <input type="hidden" name="line" value={line.productId} />
            <input type="hidden" name={`name:${line.productId}`} value={line.name} />
            <input type="hidden" name={`max:${line.productId}`} value={line.qty} />
            <TextField
              label={line.name}
              name={`send:${line.productId}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={line.qty}
              step={1}
              defaultValue={line.qty}
              hint={`Ordered ${line.qty}`}
            />
          </div>
        ))}
      </div>
      <DateAndButtons minDate={minDate} defaultDate={defaultDate}>
        <Button type="submit" variant="primary" disabled={pending}>
          Send part order
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DateAndButtons>
      <FormError id={errorId}>{error}</FormError>
    </form>
  );
}
