"use client";

import type { CatalogueItem } from "@/domain/catalogue";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Pill } from "@/ui/Pill";
import { CatalogueForm } from "./CatalogueForm";
import type { DraftLine } from "./draft";
import type { LineView } from "./line-view";
import { ProductPicker } from "./ProductPicker";
import type { SupplierOption } from "./review-types";
import { Stepper } from "./Stepper";

const BORDERS: Record<LineView["border"], string> = {
  plain: "border-line",
  warn: "border-warn",
  bad: "border-bad",
};

const linkButtonClass =
  "inline-flex min-h-6 items-center border-0 bg-transparent p-0 text-[.8rem] text-muted underline underline-offset-2 hover:text-ink";

export type LineHandlers = {
  onPick: (line: DraftLine, productId: string | null) => void;
  onQty: (line: DraftLine, qty: number) => void;
  onRemove: (line: DraftLine) => void;
  onSwap: (line: DraftLine, productId: string) => void;
  onOpenAdd: (line: DraftLine) => void;
  onCloseAdd: () => void;
  onAdded: (line: DraftLine, productId: string, name: string) => void;
};

type Props = {
  line: DraftLine;
  view: LineView;
  byId: Map<string, CatalogueItem>;
  catalogue: CatalogueItem[];
  suppliers: SupplierOption[];
  adding: boolean;
  handlers: LineHandlers;
};

function Info({ line, view, handlers }: Pick<Props, "line" | "view" | "handlers">) {
  if (view.over) {
    return (
      <>
        <span className="font-semibold text-bad">{view.message}</span>
        {view.substitute ? (
          <>
            {" "}
            <button type="button" className={linkButtonClass} onClick={() => view.substitute && handlers.onSwap(line, view.substitute.id)}>
              Use {view.substitute.name} instead
            </button>
          </>
        ) : null}
      </>
    );
  }
  if (view.message) return <>{view.message}</>;
  return (
    <>
      {view.details.join(" · ")}
      {view.lastPaidNote ? (
        <>
          {" · "}
          <span className="font-semibold text-warn">{view.lastPaidNote}</span>
        </>
      ) : null}
    </>
  );
}

/** One review line: what was typed, its status, the product, the quantity and what Tradelink knows about it. */
export function LineCard({ line, view, byId, catalogue, suppliers, adding, handlers }: Props) {
  const label = view.item?.name ?? line.sourceText;
  return (
    <li
      className={cx(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 shadow-card",
        BORDERS[view.border],
      )}
    >
      <div className="col-span-full flex flex-wrap items-center justify-between gap-1.5">
        <span className="min-w-0 font-mono text-[.86rem] text-muted [overflow-wrap:anywhere]">{line.sourceText}</span>
        <Pill tone={view.pill.tone}>{view.pill.label}</Pill>
      </div>
      {adding ? (
        <CatalogueForm
          sourceText={line.sourceText}
          catalogue={catalogue}
          suppliers={suppliers}
          onAdded={(productId, name) => handlers.onAdded(line, productId, name)}
          onCancel={handlers.onCloseAdd}
        />
      ) : null}
      <ProductPicker
        value={line.productId}
        options={line.options}
        byId={byId}
        catalogue={catalogue}
        label={`Product for ${line.sourceText}`}
        onChange={(productId) => handlers.onPick(line, productId)}
      />
      <Stepper value={line.qty} onChange={(qty) => handlers.onQty(line, qty)} productLabel={label} />
      <div className="col-span-full flex flex-wrap items-center gap-x-2 gap-y-1 text-[.82rem] text-muted">
        <span>
          <Info line={line} view={view} handlers={handlers} />
        </span>
        {view.canAddToCatalogue && !adding ? <Button onClick={() => handlers.onOpenAdd(line)}>Add to catalogue</Button> : null}
        <button type="button" className={linkButtonClass} onClick={() => handlers.onRemove(line)}>
          Remove<span className="sr-only"> {label}</span>
        </button>
      </div>
    </li>
  );
}
