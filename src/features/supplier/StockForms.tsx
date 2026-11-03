"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import type { CatalogueItem } from "@/domain/catalogue";
import { toCents } from "@/domain/money";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { adjustStockAction, changePriceAction, confirmStockAction, receiveStockAction } from "./inventoryActions";
import { ADJUST_REASONS } from "./stock";
import { useSupplierForm } from "./useSupplierForm";

export type Mode = "receive" | "confirm" | "price" | "adjust";

type FormProps = { item: CatalogueItem; idemKey: string; onClose: () => void };

type ShellProps = {
  item: CatalogueItem;
  idemKey: string;
  submitLabel: string;
  error: string | null;
  errorId: string;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  children: ReactNode;
};

function FormShell({ item, idemKey, submitLabel, error, errorId, pending, onSubmit, onClose, children }: ShellProps) {
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-describedby={error ? errorId : undefined}
      className="flex flex-col gap-2.5 rounded-md border border-line bg-sunken p-3"
    >
      <input type="hidden" name="productId" value={item.id} />
      <input type="hidden" name="key" value={idemKey} />
      <input type="hidden" name="productName" value={item.name} />
      <FieldGrid>{children}</FieldGrid>
      <FormError id={errorId}>{error}</FormError>
      <div className="flex flex-wrap gap-1.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {submitLabel}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

/** Receive stock: whole numbers from 1 to 9999 (SUP-12). */
export function ReceiveForm({ item, idemKey, onClose }: FormProps) {
  const errorId = useId();
  const form = useSupplierForm(receiveStockAction, { onSuccess: onClose });
  return (
    <FormShell item={item} idemKey={idemKey} submitLabel="Add" errorId={errorId} onClose={onClose} {...form}>
      <TextField label="Units received" name="qty" type="number" inputMode="numeric" min={1} max={9999} step={1} autoFocus />
    </FormShell>
  );
}

/** Confirm stock for a product a buyer added: quantity, price and reorder level (SUP-13). */
export function ConfirmForm({ item, idemKey, onClose }: FormProps) {
  const errorId = useId();
  const form = useSupplierForm(confirmStockAction, { onSuccess: onClose });
  return (
    <FormShell item={item} idemKey={idemKey} submitLabel="Confirm stock" errorId={errorId} onClose={onClose} {...form}>
      <TextField label="Quantity received" name="qty" type="number" inputMode="numeric" min={1} max={9999} step={1} autoFocus />
      <TextField label="Price (S$)" name="price" type="number" inputMode="decimal" min={0} step={0.01} defaultValue={item.price} />
      <TextField label="Reorder at" name="reorder" type="number" inputMode="numeric" min={0} step={1} defaultValue={5} />
    </FormShell>
  );
}

/** Change price; saving the same price just closes the field (SUP-14). */
export function PriceForm({ item, idemKey, onClose }: FormProps) {
  const errorId = useId();
  const form = useSupplierForm(changePriceAction, { onSuccess: onClose });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    const typed = String(new FormData(event.currentTarget).get("price") ?? "").trim();
    if (/^\d+(\.\d{1,2})?$/.test(typed) && toCents(typed) === toCents(item.price)) {
      event.preventDefault();
      onClose();
      return;
    }
    form.onSubmit(event);
  };
  return (
    <FormShell
      item={item}
      idemKey={idemKey}
      submitLabel="Save"
      errorId={errorId}
      onClose={onClose}
      error={form.error}
      pending={form.pending}
      onSubmit={onSubmit}
    >
      <TextField label="New price (S$)" name="price" type="number" inputMode="decimal" min={0} step={0.01} defaultValue={item.price} autoFocus />
    </FormShell>
  );
}

/** Adjust stock by a signed change with a reason and an optional note (SUP-15). */
export function AdjustForm({ item, idemKey, onClose }: FormProps) {
  const errorId = useId();
  const form = useSupplierForm(adjustStockAction, { onSuccess: onClose });
  return (
    <FormShell item={item} idemKey={idemKey} submitLabel="Save" errorId={errorId} onClose={onClose} {...form}>
      <TextField
        label="Change in units"
        hint="Use a minus sign to remove stock."
        name="change"
        type="number"
        inputMode="numeric"
        min={-9999}
        max={9999}
        step={1}
        autoFocus
      />
      <SelectField label="Reason" name="reason" defaultValue="">
        <option value="" disabled>
          Choose a reason
        </option>
        {ADJUST_REASONS.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {reason.label}
          </option>
        ))}
      </SelectField>
      <TextField label="Note (optional)" name="note" maxLength={500} />
    </FormShell>
  );
}
