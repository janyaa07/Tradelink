"use client";

import { useId, useState, type ReactNode } from "react";
import type { OrderView } from "@/features/orders/queries";
import { Button } from "@/ui/Button";
import { controlClass, TextField } from "@/ui/Field";
import { formatDate } from "@/ui/format";
import { FormError } from "@/ui/FormError";
import { addDays, isIsoDate } from "./dates";
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

/** How many days after the first delivery the rest starts at, when the supplier sends it later. */
const REST_GAP_DAYS = 7;

function Hidden({ order, idemKey }: Pick<Props, "order" | "idemKey">) {
  return (
    <>
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="key" value={idemKey} />
    </>
  );
}

type DateProps = Pick<Props, "minDate" | "defaultDate"> & {
  children: ReactNode;
  /** Set to follow the date as it changes, such as for the rest's earliest date. */
  onDateChange?: (date: string) => void;
};

/** The delivery date with the form's buttons beside it. */
function DateAndButtons({ minDate, defaultDate, onDateChange, children }: DateProps) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="w-full max-w-48">
        <TextField
          label="Delivery date"
          name="date"
          type="date"
          min={minDate}
          defaultValue={defaultDate}
          onChange={onDateChange ? (event) => onDateChange(event.currentTarget.value) : undefined}
        />
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

type Rest = "dropped" | "later";

/** What the buyer is told about the part that is not sent now. */
function restHint(rest: Rest, firstDate: string, laterDate: string): string {
  if (rest === "dropped") return "The buyer is told what is not coming and can order the rest from their order page.";
  const first = isIsoDate(firstDate) ? formatDate(firstDate) : "the first date";
  const later = isIsoDate(laterDate) ? formatDate(laterDate) : "the later date";
  return `The buyer sees two deliveries on one order: what you send now on ${first}, the rest on ${later}.`;
}

/**
 * "How much can you send?" with a field per line from 0 to the ordered quantity (SUP-05). What is not
 * sent now is either not coming, or stays on the order for a second delivery on a later date.
 */
export function PartAcceptForm({ order, idemKey, minDate, defaultDate, onClose }: Props) {
  const errorId = useId();
  const restName = `${errorId}-rest`;
  const [rest, setRest] = useState<Rest>("dropped");
  const [firstDate, setFirstDate] = useState(defaultDate);
  const [laterDate, setLaterDate] = useState(() => addDays(defaultDate, REST_GAP_DAYS));
  const laterMin = isIsoDate(firstDate) ? addDays(firstDate, 1) : addDays(minDate, 1);
  const lines = order.lines.map((line) => ({ productId: line.productId, name: line.name, qty: line.qty }));

  const check = (form: FormData) => {
    const values = Object.fromEntries(lines.map((line) => [line.productId, String(form.get(`send:${line.productId}`) ?? "")]));
    const result = checkPartQuantities(lines, values);
    if (!result.ok) return result.error;
    if (rest === "later") {
      if (!isIsoDate(laterDate) || laterDate < laterMin) return "The rest has to come after the first delivery.";
      if (result.rejectsOrder) return "Send something now, or accept the whole order for the later date instead.";
    }
    return null;
  };
  const { onSubmit, error, pending } = useSupplierForm(partAcceptOrderAction, { check, onSuccess: onClose });
  const headingId = `${errorId}-heading`;
  const hintId = `${errorId}-hint`;

  const changeFirstDate = (date: string) => {
    setFirstDate(date);
    if (isIsoDate(date) && laterDate <= date) setLaterDate(addDays(date, REST_GAP_DAYS));
  };

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
      {/* A disabled date is left out of the form, so laterDate is only sent when the rest comes later. */}
      <fieldset className="flex flex-col gap-1.5 text-[.84rem]" aria-describedby={hintId}>
        <legend className="mb-1 text-[.82rem] text-muted">What you cannot send now</legend>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2">
            <input type="radio" name={restName} className="size-4 accent-accent" checked={rest === "dropped"} onChange={() => setRest("dropped")} />
            Not coming
          </label>
          <span className="flex flex-wrap items-center gap-2">
            <label className="flex min-h-10 cursor-pointer items-center gap-2">
              <input type="radio" name={restName} className="size-4 accent-accent" checked={rest === "later"} onChange={() => setRest("later")} />
              Send the rest on
            </label>
            <input
              type="date"
              aria-label="Date for the rest"
              name="laterDate"
              min={laterMin}
              value={laterDate}
              disabled={rest !== "later"}
              onChange={(event) => setLaterDate(event.currentTarget.value)}
              className={`${controlClass} w-auto`}
            />
          </span>
        </div>
        <p id={hintId} className="text-[.8rem] text-muted">
          {restHint(rest, firstDate, laterDate)}
        </p>
      </fieldset>
      <DateAndButtons minDate={minDate} defaultDate={defaultDate} onDateChange={changeFirstDate}>
        <Button type="submit" variant="primary" disabled={pending}>
          Send part order
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DateAndButtons>
      <FormError id={errorId}>{error}</FormError>
    </form>
  );
}
