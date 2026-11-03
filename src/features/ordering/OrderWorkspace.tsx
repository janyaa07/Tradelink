"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { plural, type CatalogueItem } from "@/domain/catalogue";
import { mergeLines, parseStockShort } from "@/domain/review";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { placeOrdersAction, readOrderAction } from "./actions";
import { ComposePanel } from "./ComposePanel";
import type { DraftLine } from "./draft";
import type { LineHandlers } from "./LineCard";
import { addOne, addUsuals, markAdded, pickProduct, quantitiesByProduct, removeLine, setQuantity, swapProduct } from "./line-ops";
import { OrderSummary } from "./OrderSummary";
import { ReviewLines } from "./ReviewLines";
import type { OrderPageData } from "./review-types";
import { SyncNotice } from "./SyncNotice";
import { useDraftSync } from "./useDraftSync";
import { useReviewModel } from "./useReviewModel";
import { UsualsRow } from "./UsualsRow";

const READ_FALLBACK_NOTE = "We could not read this automatically. Check each line.";
const newId = () => crypto.randomUUID();

/** Order: compose (typed order, usuals) and the mandatory review before anything is sent (BUY-10 to BUY-22). */
export function OrderWorkspace({ data }: { data: OrderPageData }) {
  const router = useRouter();
  const { show } = useToast();
  const sync = useDraftSync(data.draft.version);
  const linesRef = useRef(data.draft.lines);
  const [lines, setLines] = useState(data.draft.lines);
  const [placeKey, setPlaceKey] = useState(newId);
  const [mode, setMode] = useState<"compose" | "review">(data.draft.lines.length > 0 ? "review" : "compose");
  const [text, setText] = useState("");
  const [readNote, setReadNote] = useState<string | null>(null);
  const [short, setShort] = useState<Map<string, number>>(() => new Map());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [placing, startPlacing] = useTransition();
  const model = useReviewModel(lines, data, short);

  /** Every change: new lines, saved to the draft, and a new key because the order to confirm changed. */
  const commit = (change: (current: DraftLine[]) => DraftLine[]) => {
    const next = change(linesRef.current);
    linesRef.current = next;
    setLines(next);
    sync.save(next);
    setPlaceKey(newId());
  };

  const addProduct = (item: CatalogueItem) => {
    commit((current) => addOne(current, item.id, newId()));
    show(`${item.name} added.`);
  };

  const loadUsual = () => {
    if (!data.usuals.some((usual) => model.byId.has(usual.productId))) {
      show("You have no usual items yet. Add them in Settings.");
      return;
    }
    commit((current) => addUsuals(current, data.usuals, model.byId, newId));
    setMode("review");
  };

  const read = () =>
    startReading(async () => {
      const result = await readOrderAction(text);
      if (!result.ok) {
        show(result.error);
        return;
      }
      commit((current) => mergeLines(current, result.data.lines));
      setReadNote(result.data.readBy === "rules" ? READ_FALLBACK_NOTE : null);
      setMode("review");
    });

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

  const usualItems = data.usuals.flatMap((usual) => {
    const item = model.byId.get(usual.productId);
    return item ? [item] : [];
  });

  return (
    <div className="flex flex-col gap-4 @container">
      <div className="flex flex-col gap-[3px]">
        <h1>Order</h1>
        <p className="text-muted">Type it the way you would text a supplier, or tap your usuals.</p>
      </div>
      <SyncNotice problem={sync.problem} />
      {mode === "compose" ? (
        <>
          <ComposePanel
            text={text}
            reading={reading}
            onText={setText}
            onRead={read}
            onUseUsual={loadUsual}
            onManual={() => setMode("review")}
          />
          {lines.length > 0 ? (
            <Button variant="primary" className="self-start" onClick={() => setMode("review")}>
              Review {plural(lines.length, "line")}
            </Button>
          ) : null}
          <UsualsRow items={usualItems} inOrder={quantitiesByProduct(lines)} onAdd={addProduct} onAddAll={loadUsual} />
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[980px]:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-2">
            {readNote ? <p className="text-[.84rem] font-semibold text-warn">{readNote}</p> : null}
            <ReviewLines
              lines={lines}
              views={model.views}
              byId={model.byId}
              catalogue={model.catalogue}
              suppliers={data.suppliers}
              addingId={addingId}
              handlers={handlers}
              onAddProduct={(productId) => {
                const item = model.byId.get(productId);
                if (item) addProduct(item);
              }}
              onEdit={() => setMode("compose")}
            />
          </div>
          <OrderSummary
            groups={model.groups}
            totalCents={model.totalCents}
            cutoffs={data.cutoffs}
            budgetWarning={model.budgetWarning}
            blockers={model.blockers}
            placing={placing}
            onPlace={place}
          />
        </div>
      )}
    </div>
  );
}
