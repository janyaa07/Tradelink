"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { plural } from "@/domain/catalogue";
import { formatMoney } from "@/domain/money";
import { parseStockShort } from "@/domain/review";
import { LinkButton } from "@/ui/LinkButton";
import { useToast } from "@/ui/Toast";
import { placeOrdersAction } from "./actions";
import { CartItem, type LineHandlers } from "./CartItem";
import type { CartPageData } from "./cart-types";
import type { DraftLine } from "./draft";
import { markAdded, pickProduct, removeLine, setQuantity, swapProduct } from "./line-ops";
import { OrderSummary, PlaceBar } from "./OrderSummary";
import { SyncNotice } from "./SyncNotice";
import { useCartModel } from "./useCartModel";
import { useDraftSync } from "./useDraftSync";

const newId = () => crypto.randomUUID();

const groupClass = "flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card";
const groupHeadClass = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-line px-3.5 py-2.5";

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface px-4 py-12 text-center shadow-card">
      <p className="text-[1.15rem] font-semibold">Your cart is empty</p>
      <p className="max-w-[340px] text-muted">Tell the assistant what you need, or pick products from the catalogue.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <LinkButton href="/buyer/assistant" variant="primary">
          Open Assistant
        </LinkButton>
        <LinkButton href="/buyer/products">Browse products</LinkButton>
      </div>
    </div>
  );
}

/** The cart: lines split by supplier, then one Place order for every supplier (BUY-13 to BUY-22). */
export function CartWorkspace({ data }: { data: CartPageData }) {
  const router = useRouter();
  const { show } = useToast();
  const headingId = useId();
  const sync = useDraftSync(data.draft.version);
  const linesRef = useRef(data.draft.lines);
  const [lines, setLines] = useState(data.draft.lines);
  const [placeKey, setPlaceKey] = useState(newId);
  const [short, setShort] = useState<Map<string, number>>(() => new Map());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [placing, startPlacing] = useTransition();
  const model = useCartModel(lines, data, short);

  /** Every change: new lines, saved to the draft, and a new key because the order to place changed. */
  const commit = (change: (current: DraftLine[]) => DraftLine[]) => {
    const next = change(linesRef.current);
    linesRef.current = next;
    setLines(next);
    sync.save(next);
    setPlaceKey(newId());
  };

  const place = () =>
    startPlacing(async () => {
      await sync.whenSaved();
      const payload = linesRef.current.flatMap((line) =>
        line.productId && model.byId.has(line.productId)
          ? [{ productId: line.productId, qty: line.qty, sourceText: line.sourceText }]
          : [],
      );
      const result = await placeOrdersAction({ lines: payload, draftVersion: sync.currentVersion(), key: placeKey });
      if (result.ok) {
        const message = `${plural(result.data.orders.length, "order")} placed and stock reserved.`;
        router.push(`/buyer/orders?toast=${encodeURIComponent(message)}`);
        return;
      }
      if (result.reason === "STOCK_SHORT") {
        const found = parseStockShort(result.detail);
        setShort((previous) => new Map([...previous, ...found]));
        router.refresh();
      }
      show(result.error);
    });

  const handlers: LineHandlers = {
    onPick: (line, productId) => {
      if (addingId === line.id) setAddingId(null);
      commit((current) => pickProduct(current, line.id, productId ? (model.byId.get(productId) ?? null) : null));
    },
    onQty: (line, qty) => commit((current) => setQuantity(current, line.id, qty)),
    onRemove: (line) => {
      if (addingId === line.id) setAddingId(null);
      commit((current) => removeLine(current, line.id));
    },
    onSwap: (line, productId) => commit((current) => swapProduct(current, line.id, productId)),
    onOpenAdd: (line) => setAddingId(line.id),
    onCloseAdd: () => setAddingId(null),
    onAdded: (line, productId, name) => {
      setAddingId(null);
      commit((current) => markAdded(current, line.id, productId));
      show(`${name} added to the catalogue.`);
    },
  };

  const renderLine = (line: DraftLine) => {
    const view = model.views.get(line.id);
    return view ? (
      <CartItem
        key={line.id}
        line={line}
        view={view}
        byId={model.byId}
        catalogue={model.catalogue}
        suppliers={data.suppliers}
        adding={addingId === line.id}
        handlers={handlers}
      />
    ) : null;
  };

  const subtotal = new Map(model.subtotals.map((group) => [group.supplierOrgId, group.totalCents]));
  const summary = {
    subtotals: model.subtotals,
    totalCents: model.totalCents,
    cutoffs: data.cutoffs,
    budgetWarning: model.budgetWarning,
    blockers: model.blockers,
    placing,
    onPlace: place,
  };

  return (
    <div className="flex flex-col gap-4 @container">
      <div className="flex flex-col gap-[3px]">
        <h1>Cart</h1>
        {lines.length > 0 ? <p className="text-muted">{plural(lines.length, "line")}</p> : null}
      </div>
      <SyncNotice problem={sync.problem} />
      {lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 @min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-4">
              {model.cart.unresolved.length > 0 ? (
                <section aria-labelledby={`${headingId}-check`} className={groupClass}>
                  <div className={groupHeadClass}>
                    <h2 id={`${headingId}-check`} className="text-[1rem]">
                      Needs your attention
                    </h2>
                    <span className="text-[.82rem] text-muted">Choose a product or remove the line</span>
                  </div>
                  <ul className="flex flex-col divide-y divide-line">{model.cart.unresolved.map(renderLine)}</ul>
                </section>
              ) : null}
              {model.cart.suppliers.map((group) => (
                <section key={group.supplierOrgId} aria-labelledby={`${headingId}-${group.supplierOrgId}`} className={groupClass}>
                  <div className={groupHeadClass}>
                    <h2 id={`${headingId}-${group.supplierOrgId}`} className="text-[1rem]">
                      {group.supplierName}
                    </h2>
                    <span className="text-[.82rem] text-muted">
                      {data.cutoffs[group.supplierOrgId] ? `${data.cutoffs[group.supplierOrgId]} · ` : null}
                      <span className="tabular-nums">{formatMoney(subtotal.get(group.supplierOrgId) ?? 0)}</span>
                    </span>
                  </div>
                  <ul className="flex flex-col divide-y divide-line">{group.lines.map(renderLine)}</ul>
                </section>
              ))}
              <LinkButton href="/buyer/products" variant="text" className="self-start">
                Add more products
              </LinkButton>
            </div>
            <OrderSummary {...summary} />
          </div>
          <PlaceBar {...summary} />
        </>
      )}
    </div>
  );
}
