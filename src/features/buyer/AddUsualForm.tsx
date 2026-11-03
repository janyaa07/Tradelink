"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { Panel } from "@/ui/Panel";
import { useToast } from "@/ui/Toast";
import { setUsualItemAction } from "./settings-actions";

type Option = { id: string; label: string };

/** Adds any product the buyer can see as a usual item (BUY-46). */
export function AddUsualForm({ options }: { options: Option[] }) {
  const { show } = useToast();
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
      show(`${name} added to your usual items.`);
    });
  };

  if (options.length === 0) return null;
  return (
    <Panel title="Add a usual item">
      <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
        <FieldGrid>
          <SelectField label="Product" value={productId} onChange={(event) => setProductId(event.currentTarget.value)}>
            <option value="">Choose a product</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Usual order" type="number" min="1" step="1" value={usualQty} onChange={(event) => setUsualQty(event.currentTarget.value)} />
          <TextField label="Use per day" type="number" min="0" step="any" value={usePerDay} onChange={(event) => setUsePerDay(event.currentTarget.value)} />
          <TextField label="In your shop" type="number" min="0" step="any" value={inShop} onChange={(event) => setInShop(event.currentTarget.value)} />
        </FieldGrid>
        <FormError>{error}</FormError>
        <Button type="submit" variant="primary" className="self-start" disabled={busy}>
          Add usual item
        </Button>
      </form>
    </Panel>
  );
}
