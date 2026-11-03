"use client";

import { useState } from "react";
import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { Button } from "@/ui/Button";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard } from "@/ui/RecordCard";
import { AdjustForm, ConfirmForm, PriceForm, ReceiveForm, type Mode } from "./StockForms";
import { StockBar } from "./StockBar";
import { HEALTH_PILL } from "./stock";

/** One inventory product with its stock figures and inline stock forms (SUP-10 to SUP-15). */
export function ProductRecord({ item, idemKey }: { item: CatalogueItem; idemKey: string }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const unconfirmed = item.status === "unconfirmed";
  const pill = HEALTH_PILL[item.health];
  const close = () => setMode(null);
  const formProps = { item, idemKey, onClose: close };

  return (
    <RecordCard
      lead={<ProductArt kind={item.art} size={36} />}
      title={item.name}
      sub={<span className="font-mono text-[.86em]">{item.sku}</span>}
      pill={<Pill tone={pill.tone}>{pill.label}</Pill>}
      metrics={[
        { label: "Price", value: formatMoney(item.price) },
        { label: "On hand", value: item.onHand },
        { label: "Reserved", value: item.reserved },
        { label: "Available", value: unconfirmed ? "To confirm" : item.available },
        { label: "Reorder at", value: item.reorderLevel },
      ]}
      actions={
        mode === null ? (
          <>
            <Button onClick={() => setMode(unconfirmed ? "confirm" : "receive")}>
              {unconfirmed ? "Confirm stock" : "Receive stock"}
            </Button>
            <Button onClick={() => setMode("price")}>Change price</Button>
            {unconfirmed ? null : <Button onClick={() => setMode("adjust")}>Adjust stock</Button>}
          </>
        ) : null
      }
    >
      <StockBar item={item} />
      {mode === "receive" ? <ReceiveForm {...formProps} /> : null}
      {mode === "confirm" ? <ConfirmForm {...formProps} /> : null}
      {mode === "price" ? <PriceForm {...formProps} /> : null}
      {mode === "adjust" ? <AdjustForm {...formProps} /> : null}
    </RecordCard>
  );
}
