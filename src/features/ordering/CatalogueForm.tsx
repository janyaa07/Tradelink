"use client";

import { useState, useTransition } from "react";
import { UNITS, type CatalogueItem, type Unit } from "@/domain/catalogue";
import { guessProductName, guessUnit } from "@/domain/review";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { buyerAddProductAction } from "./actions";
import type { SupplierOption } from "./cart-types";

type Props = {
  sourceText: string;
  catalogue: CatalogueItem[];
  suppliers: SupplierOption[];
  onAdded: (productId: string, name: string) => void;
  onCancel: () => void;
};

function toUnit(value: string): Unit {
  return UNITS.find((unit) => unit === value) ?? "pack";
}

function validate(name: string, price: number, supplierId: string, catalogue: CatalogueItem[]): string | null {
  if (name.length < 2 || name.length > 80) return "Enter a product name.";
  const lower = name.toLowerCase();
  if (catalogue.some((item) => item.supplierOrgId === supplierId && item.name.toLowerCase() === lower)) {
    return "This product is already in the catalogue. Choose it from the list.";
  }
  if (!(price > 0) || price > 99999) return "Enter a price above 0.";
  if (!supplierId) return "Choose a supplier.";
  return null;
}

/** Adds a product a connected supplier sells but has not listed, as unconfirmed (BUY-18). */
export function CatalogueForm({ sourceText, catalogue, suppliers, onAdded, onCancel }: Props) {
  const [name, setName] = useState(() => guessProductName(sourceText));
  const [unit, setUnit] = useState<Unit>(() => guessUnit(sourceText));
  const [price, setPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  const [saving, startSaving] = useTransition();

  const submit = () => {
    const trimmed = name.trim();
    const amount = Number(price);
    const problem = validate(trimmed, amount, supplierId, catalogue);
    if (problem) {
      setError(problem);
      return;
    }
    startSaving(async () => {
      const result = await buyerAddProductAction({ name: trimmed, unit, price: amount, supplierOrgId: supplierId, key });
      if (result.ok) onAdded(result.data.productId, trimmed);
      else setError(result.error);
    });
  };

  return (
    <div className="col-span-full flex flex-col gap-2.5 rounded-md border border-line bg-sunken p-3">
      <h3 className="text-[.84rem] font-bold">Add to catalogue</h3>
      <FieldGrid>
        <TextField label="Product name" value={name} maxLength={80} onChange={(event) => setName(event.currentTarget.value)} autoFocus />
        <SelectField label="Sold by" value={unit} onChange={(event) => setUnit(toUnit(event.currentTarget.value))}>
          {UNITS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Estimated price (S$)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.currentTarget.value)}
        />
        <SelectField label="Supplier" value={supplierId} onChange={(event) => setSupplierId(event.currentTarget.value)}>
          <option value="">Choose a supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.status === "invited" ? `${supplier.name} (invited)` : supplier.name}
            </option>
          ))}
        </SelectField>
      </FieldGrid>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={submit} disabled={saving}>
          Add to catalogue
        </Button>
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
