"use client";

import type { CatalogueItem } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { Pill } from "@/ui/Pill";
import { ProductImage } from "@/ui/ProductImage";
import { CatalogueForm } from "./CatalogueForm";
import type { SupplierOption } from "./cart-types";
import type { DraftLine } from "./draft";
import type { LineView } from "./line-view";
import { ProductPicker } from "./ProductPicker";
import { Stepper } from "./Stepper";

const TINTS: Record<LineView["border"], string> = {
  plain: "",
  warn: "bg-warn-soft/50",
  bad: "bg-bad-soft/50",
};

const linkButtonClass =
  "inline-flex min-h-8 items-center border-0 bg-transparent p-0 text-[.84rem] text-muted underline underline-offset-2 hover:text-ink";

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

function Picture({ item }: { item: CatalogueItem | null }) {
  if (item) return <ProductImage art={item.art} category={item.category} name={item.name} size="sm" decorative />;
  return (
    <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-sm border border-dashed border-control-line text-muted">
      ?
    </span>
  );
}

/** One cart line: picture, name, a pill only when it needs attention, quantity, line total and Remove (BUY-14 to BUY-18). */
export function CartItem({ line, view, byId, catalogue, suppliers, adding, handlers }: Props) {
  const { item } = view;
  const label = item?.name ?? line.sourceText;
  const choosing = !item || line.state === "check";
  return (
    <li className={cx("flex gap-3 px-3.5 py-3.5", TINTS[view.border])}>
      <Picture item={item} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold leading-snug [overflow-wrap:anywhere]">{label}</span>
            {view.unitPrice ? (
              <span className="text-[.82rem] text-muted tabular-nums">
                {view.unitPrice}
                {view.estimated ? ", estimated" : null}
              </span>
            ) : null}
            {view.attention && item ? <span className="text-[.82rem] text-muted [overflow-wrap:anywhere]">You typed: {line.sourceText}</span> : null}
          </div>
          {view.attention ? <Pill tone={view.attention.tone}>{view.attention.label}</Pill> : null}
        </div>

        {view.message ? (
          <p className={cx("text-[.84rem]", view.over ? "font-semibold text-bad" : "text-muted")}>
            {view.message}
            {view.substitute ? (
              <>
                {" "}
                <button type="button" className={linkButtonClass} onClick={() => view.substitute && handlers.onSwap(line, view.substitute.id)}>
                  Use {view.substitute.name} instead
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        {choosing ? (
          <ProductPicker
            value={line.productId}
            options={line.options}
            byId={byId}
            catalogue={catalogue}
            label={`Product for ${line.sourceText}`}
            onChange={(productId) => handlers.onPick(line, productId)}
          />
        ) : null}

        {view.canAddToCatalogue && !adding ? (
          <Button className="self-start" onClick={() => handlers.onOpenAdd(line)}>
            Add to catalogue
          </Button>
        ) : null}
        {adding ? (
          <CatalogueForm
            sourceText={line.sourceText}
            catalogue={catalogue}
            suppliers={suppliers}
            onAdded={(productId, name) => handlers.onAdded(line, productId, name)}
            onCancel={handlers.onCloseAdd}
          />
        ) : null}

        {view.notes.length > 0 || view.lastPaidNote ? (
          <p className="text-[.82rem] text-muted">
            {view.notes.join(" · ")}
            {view.notes.length > 0 && view.lastPaidNote ? " · " : null}
            {view.lastPaidNote ? <span className="font-semibold text-warn">{view.lastPaidNote}</span> : null}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Stepper value={line.qty} onChange={(qty) => handlers.onQty(line, qty)} productLabel={label} />
          <span className="flex items-center gap-3">
            {view.totalCents !== null ? <b className="tabular-nums">{formatMoney(view.totalCents)}</b> : null}
            <button type="button" className={linkButtonClass} onClick={() => handlers.onRemove(line)}>
              Remove<span className="sr-only"> {label}</span>
            </button>
          </span>
        </div>
      </div>
    </li>
  );
}
