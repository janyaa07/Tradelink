"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { useToast } from "@/ui/Toast";
import { setUsualItemAction } from "./settings-actions";

type Option = { id: string; label: string };

/** "Add a usual item": opens a short form for any product the buyer can see (BUY-46). */
export function AddUsualForm({ options }: { options: Option[] }) {
  const { show } = useToast();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [usualQty, setUsualQty] = useState("1");
  const [usePerDay, setUsePerDay] = useState("1");
  const [inShop, setInShop] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productId) {
      setError("Choose a product.");
      return;
    }
    start(async () => {
      const result = await setUsualItemAction({
        productId,
        usualQty: Number(usualQty),
        usePerDay: Number(usePerDay),
        inShop: Number(inShop),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const name = options.find((option) => option.id === productId)?.label ?? "Product";
      setProductId("");
      setError(null);
      setOpen(false);
      show(`${name} added to your usual items.`);
    });
  };

  if (options.length === 0) return null;
  if (!open) {
    return (
      <div className="border-t border-line px-4 py-3 rail:px-[18px]">
        <Button size="small" aria-expanded={false} onClick={() => setOpen(true)}>
          Add a usual item
        </Button>
      </div>
    );
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Add a usual item"
      className="flex flex-col gap-3 border-t border-line bg-sunken/40 px-4 py-3.5 rail:px-[18px]"
    >
      <h3 className="text-[.875rem] font-semibold">Add a usual item</h3>
      <SelectField label="Product" value={productId} onChange={(event) => setProductId(event.currentTarget.value)}>
        <option value="">Choose a product</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-3 gap-2">
        <TextField label="Usual order" type="number" min="1" step="1" value={usualQty} onChange={(event) => setUsualQty(event.currentTarget.value)} />
        <TextField label="In your shop" type="number" min="0" step="any" value={inShop} onChange={(event) => setInShop(event.currentTarget.value)} />
        <TextField
          label="Use per day"
          type="number"
          min="0"
          step="any"
          value={usePerDay}
          onChange={(event) => setUsePerDay(event.currentTarget.value)}
        />
      </div>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy}>
          Add usual item
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
