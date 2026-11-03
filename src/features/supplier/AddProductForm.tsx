"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { CATEGORIES, CATEGORY_LABELS, UNITS, type Category } from "@/domain/catalogue";
import { Button } from "@/ui/Button";
import { FieldGrid, SelectField, TextField } from "@/ui/Field";
import { FormError } from "@/ui/FormError";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";
import { addProductAction } from "./inventoryActions";
import { guessCategory } from "./product";
import { useSupplierForm } from "./useSupplierForm";

/** Add a product (SUP-11). The category follows the name until the supplier picks one. */
export function AddProductForm({ idemKey, closeHref }: { idemKey: string; closeHref: string }) {
  const router = useRouter();
  const errorId = useId();
  const [category, setCategory] = useState<Category>("supplies");
  const [categoryChosen, setCategoryChosen] = useState(false);
  const { onSubmit, error, pending } = useSupplierForm(addProductAction, {
    onSuccess: () => router.replace(closeHref, { scroll: false }),
  });

  return (
    <Panel title="Add a product">
      <form onSubmit={onSubmit} noValidate aria-describedby={error ? errorId : undefined} className="flex flex-col gap-2.5">
        <input type="hidden" name="key" value={idemKey} />
        <FieldGrid>
          <TextField
            label="Product name"
            name="name"
            placeholder="Red lentils 1kg"
            maxLength={80}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              if (!categoryChosen) setCategory(guessCategory(event.target.value));
            }}
          />
          <SelectField label="Sold by" name="unit" defaultValue="pack">
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </SelectField>
          <TextField label="Price (S$)" name="price" type="number" inputMode="decimal" min={0} step={0.01} />
          <TextField label="Opening stock" name="opening" type="number" inputMode="numeric" min={0} step={1} />
          <TextField label="Reorder at" name="reorder" type="number" inputMode="numeric" min={0} step={1} />
          <SelectField
            label="Category"
            name="category"
            value={category}
            onChange={(event) => {
              const chosen = CATEGORIES.find((value) => value === event.target.value);
              if (!chosen) return;
              setCategory(chosen);
              setCategoryChosen(true);
            }}
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </FieldGrid>
        <FormError id={errorId}>{error}</FormError>
        <div className="flex flex-wrap gap-1.5">
          <Button type="submit" variant="primary" disabled={pending}>
            Add product
          </Button>
          <LinkButton href={closeHref} scroll={false}>
            Cancel
          </LinkButton>
        </div>
        <p className="text-[.8rem] text-muted">Buyers can see and order this product as soon as you add it.</p>
      </form>
    </Panel>
  );
}
