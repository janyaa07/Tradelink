"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { CATEGORIES, CATEGORY_LABELS, UNITS } from "@/domain/catalogue";
import type { AiAlert, AiCard, AiCart, AiCartLine, AiNewProduct, AiNewSupplier, AiOrder, AiProblem, AiProduct, AiStock, AiSupplier } from "@/domain/ask/types";
import { formatMoney } from "@/domain/money";
import { executeAiAction } from "@/features/ai/execute";
import { Stepper } from "@/features/ordering/Stepper";
import { StatusPill } from "@/features/orders/OrderCard";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { formatDate, orderNumber } from "@/ui/format";
import { Icon, type IconName } from "@/ui/Icon";
import { Pill, type PillTone } from "@/ui/Pill";
import { ProductImage } from "@/ui/ProductImage";

type Change = (card: AiCard) => void;

const SG_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" });
const sgDate = (offsetDays: number) => SG_DATE.format(new Date(Date.now() + offsetDays * 86_400_000));
const SHOWN_LINES = 3;

/**
 * Runs one card button through the same checked path as a confirm card (executeAiAction), so a
 * card can never do more than the person could on the matching screen.
 */
function useCardRun(onDone: (message: string, card?: AiCard) => void) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (tool: string, args: Record<string, unknown>) =>
    start(async () => {
      let outcome: Awaited<ReturnType<typeof executeAiAction>>;
      try {
        outcome = await executeAiAction({ id: crypto.randomUUID(), tool, args });
      } catch {
        outcome = { ok: false, error: "That did not go through. Try again." };
      }
      if (outcome.ok) {
        setResult({ ok: true, text: outcome.data });
        onDone(outcome.data, outcome.card);
        router.refresh();
      } else {
        setResult({ ok: false, text: outcome.error });
      }
    });
  return { busy, result, run };
}

/** A small quantity control for card lines; unlike the cart's Stepper it can go down to a minimum of 0. */
function MiniStepper({
  value,
  min,
  max,
  label,
  busy,
  onChange,
}: {
  value: number;
  min: number;
  max: number | null;
  label: string;
  busy?: boolean;
  onChange: (next: number) => void;
}) {
  const round = "grid size-7 place-items-center rounded-full text-muted hover:text-ink disabled:opacity-50";
  return (
    <span className="inline-flex flex-none items-center rounded-full border border-line bg-surface">
      <button type="button" aria-label={value === 1 && min === 0 ? `Remove ${label}` : `One less ${label}`} disabled={busy || value <= min} onClick={() => onChange(value - 1)} className={round}>
        {value === 1 && min === 0 ? "×" : "−"}
      </button>
      <span className="min-w-6 text-center text-[.85rem] font-semibold tabular-nums">{value}</span>
      <button type="button" aria-label={`One more ${label}`} disabled={busy || (max !== null && value >= max)} onClick={() => onChange(value + 1)} className={round}>
        +
      </button>
    </span>
  );
}

/** Asks for a second tap before anything that is hard to undo, such as Cancel or Reject. */
function TwoStepButton({
  label,
  confirmLabel,
  busy,
  onConfirm,
  tone = "danger",
}: {
  label: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  tone?: "danger" | "default";
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant={tone}
      disabled={busy}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={cx(armed && (tone === "danger" ? "border-bad bg-bad-soft" : "border-accent bg-accent-soft text-accent"))}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

function Frame({
  href,
  lead,
  title,
  sub,
  pill,
  children,
  actions,
  result,
  notice,
}: {
  notice?: ReactNode;
  href?: string;
  lead?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  result?: { ok: boolean; text: string } | null;
}) {
  const head = (
    <div className="flex min-w-0 items-center gap-3">
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight text-ink">{title}</p>
        {sub ? <p className="mt-0.5 truncate text-[.8rem] text-muted">{sub}</p> : null}
      </div>
      {pill}
      {href ? <Icon name="arrow" size={18} className="flex-none text-muted transition-transform duration-150 group-hover:translate-x-0.5" /> : null}
    </div>
  );
  return (
    <article className="w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow duration-150 hover:shadow-[0_6px_22px_rgb(0_0_0/0.08)]">
      {href ? (
        <Link href={href} className="group block px-3.5 pt-3 pb-2.5 text-inherit no-underline hover:bg-sunken/50">
          {head}
        </Link>
      ) : (
        <div className="px-3.5 pt-3 pb-2.5">{head}</div>
      )}
      {notice ? (
        <p className="mx-3.5 mb-2.5 flex items-center gap-1.5 rounded-lg bg-good-soft px-2.5 py-1.5 text-[.8rem] font-medium text-good">
          <Icon name="check" size={14} />
          {notice}
        </p>
      ) : null}
      {children ? <div className="px-3.5 pb-3">{children}</div> : null}
      {actions && !result?.ok ? <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sunken/40 px-3.5 py-2.5">{actions}</div> : null}
      {result ? (
        <p
          role="status"
          className={cx(
            "flex items-center gap-2 border-t px-3.5 py-2.5 text-[.875rem] font-medium",
            result.ok ? "border-good/30 bg-good-soft text-good" : "border-bad/30 bg-bad-soft text-bad",
          )}
        >
          <Icon name={result.ok ? "check" : "flag"} size={16} />
          {result.text}
        </p>
      ) : null}
    </article>
  );
}

function Lines({ lines }: { lines: AiOrder["lines"] }) {
  const more = lines.length - SHOWN_LINES;
  return (
    <ul className="flex flex-col gap-0.5 text-[.9rem]">
      {lines.slice(0, SHOWN_LINES).map((line, index) => (
        <li key={index} className="flex gap-2">
          <span className="w-9 flex-none text-right tabular-nums text-muted">{line.qty}×</span>
          <span className="min-w-0 truncate">{line.name}</span>
        </li>
      ))}
      {more > 0 ? <li className="pl-11 text-[.8rem] text-muted">+{more} more {more === 1 ? "item" : "items"}</li> : null}
    </ul>
  );
}

function OrderCardView({ card, order, onChange }: { card: Extract<AiCard, { kind: "ai_order" }>; order: AiOrder; onChange: Change }) {
  const supplier = card.view === "supplier";
  const update = (next: Partial<AiOrder>) => onChange({ ...card, order: { ...order, ...next } });
  const pendingChange = useRef<Partial<AiOrder>>({});
  const { busy, result, run } = useCardRun((_message, next) => (next && next.kind === "ai_order" ? onChange(next) : update(pendingChange.current)));
  const act = (tool: string, change: Partial<AiOrder>, args: Record<string, unknown> = {}) => {
    pendingChange.current = change;
    run(tool, { order_number: order.number, order_id: order.id, ...args });
  };
  const tomorrow = sgDate(1);
  const [date, setDate] = useState(order.deliveryDate && order.deliveryDate > tomorrow ? order.deliveryDate : tomorrow);
  const dateChoices = [tomorrow, sgDate(2)];
  const [otherDate, setOtherDate] = useState(false);
  const [sendQty, setSendQty] = useState<Record<string, number> | null>(null);
  const canPart = supplier && order.status === "pending" && order.lines.length > 0 && order.lines.every((line) => line.productId);
  const changed = sendQty ? order.lines.filter((line) => line.productId && sendQty[line.productId] !== line.qty) : [];

  let actions: ReactNode = null;
  if (supplier && order.status === "pending") {
    actions = (
      <>
        <div className="flex w-full flex-wrap items-center gap-1.5" role="group" aria-label="Delivery date">
          <span className="text-[.8rem] text-muted">Deliver</span>
          {dateChoices.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={date === choice}
              onClick={() => setDate(choice)}
              className={cx(
                "rounded-full border px-2.5 py-1 text-[.8rem] font-medium transition-colors",
                date === choice ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-ink hover:border-accent",
              )}
            >
              {formatDate(choice)}
            </button>
          ))}
          {otherDate || !dateChoices.includes(date) ? (
            <input
              type="date"
              aria-label="Pick another date"
              min={tomorrow}
              value={date}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className="rounded-full border border-accent bg-surface px-2.5 py-0.5 text-[.8rem] text-ink"
            />
          ) : (
            <button
              type="button"
              onClick={() => setOtherDate(true)}
              className="rounded-full border border-dashed border-line px-2.5 py-1 text-[.8rem] font-medium text-muted hover:border-accent hover:text-accent"
            >
              Other date
            </button>
          )}
        </div>
        {changed.length > 0 && sendQty ? (
          <Button
            variant="primary"
            disabled={busy || order.lines.every((line) => line.productId && sendQty[line.productId] === 0)}
            onClick={() =>
              act(
                "accept_part",
                {
                  status: "accepted",
                  deliveryDate: date,
                  lines: order.lines
                    .map((line) => ({ ...line, qty: line.productId ? (sendQty[line.productId] ?? line.qty) : line.qty }))
                    .filter((line) => line.qty > 0),
                },
                {
                  delivery_date: date,
                  lines: changed.map((line) => ({ product_id: line.productId, send_qty: line.productId ? sendQty[line.productId] : line.qty })),
                },
              )
            }
          >
            {busy ? "Accepting..." : `Accept with changes for ${formatDate(date)}`}
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => act("accept_order", { status: "accepted", deliveryDate: date }, { delivery_date: date })}>
            {busy ? "Accepting..." : `Accept for ${formatDate(date)}`}
          </Button>
        )}
        {canPart && !sendQty ? (
          <Button disabled={busy} onClick={() => setSendQty(Object.fromEntries(order.lines.map((line) => [line.productId ?? "", line.qty])))}>
            Change quantities
          </Button>
        ) : null}
        <TwoStepButton label="Reject" confirmLabel="Tap again to reject" busy={busy} onConfirm={() => act("reject_order", { status: "rejected" })} />
      </>
    );
  } else if (supplier && order.status === "accepted") {
    actions = (
      <>
        <Button variant="primary" disabled={busy} onClick={() => act("mark_out_for_delivery", { status: "out_for_delivery" })}>
          Out for delivery
        </Button>
        <Button disabled={busy} onClick={() => act("mark_delivered", { status: "delivered" })}>
          Mark delivered
        </Button>
      </>
    );
  } else if (supplier && order.status === "out_for_delivery") {
    actions = (
      <Button variant="primary" disabled={busy} onClick={() => act("mark_delivered", { status: "delivered" })}>
        Mark delivered
      </Button>
    );
  } else if (!supplier && order.status === "pending") {
    actions = <TwoStepButton label="Cancel order" confirmLabel="Tap again to cancel" busy={busy} onConfirm={() => act("cancel_order", { status: "cancelled" })} />;
  } else if (!supplier && order.status === "out_for_delivery") {
    actions = (
      <>
        <Button variant="primary" disabled={busy} onClick={() => act("confirm_delivery", { status: "delivered", checkStatus: "all_here" })}>
          All here
        </Button>
        <Button disabled={busy} onClick={() => act("report_not_here", {})}>
          Not here yet
        </Button>
      </>
    );
  } else if (!supplier && order.status === "delivered" && order.checkStatus === "unchecked") {
    actions = (
      <>
        <Button variant="primary" disabled={busy} onClick={() => act("confirm_delivery", { checkStatus: "all_here" })}>
          All here
        </Button>
        <Link href={`/buyer/orders/${order.id}`} className="text-[.875rem] font-semibold text-accent">
          Report a problem
        </Link>
      </>
    );
  }

  const when = order.deliveryDate ? `Delivery ${formatDate(order.deliveryDate)}` : "No delivery date yet";
  return (
    <Frame
      href={supplier ? `/supplier/orders#order-${order.number}` : `/buyer/orders/${order.id}`}
      lead={<BusinessLogo name={order.counterparty} size={36} />}
      title={order.counterparty}
      sub={`${orderNumber(order.number)} · ${when}`}
      pill={<StatusPill status={order.status} />}
      actions={actions}
      result={result}
    >
      {sendQty && order.status === "pending" ? (
        <ul className="flex flex-col gap-1.5 text-[.9rem]" aria-label="Quantities to send">
          {order.lines.map((line) => {
            const id = line.productId ?? "";
            const send = sendQty[id] ?? line.qty;
            return (
              <li key={id} className="flex items-center gap-2">
                <MiniStepper value={send} min={0} max={line.qty} label={line.name} busy={busy} onChange={(value) => setSendQty({ ...sendQty, [id]: value })} />
                <span className="min-w-0 flex-1 truncate">{line.name}</span>
                <span className={cx("flex-none text-[.8rem] tabular-nums", send === line.qty ? "text-muted" : "text-warn")}>
                  {send === 0 ? "Not sending" : `of ${line.qty}`}
                </span>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setSendQty(null)} className="text-[.8rem] font-semibold text-accent">
              Send everything
            </button>
          </li>
        </ul>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <Lines lines={order.lines} />
          <b className="flex-none tabular-nums">{formatMoney(order.totalCents)}</b>
        </div>
      )}
      {order.checkStatus === "all_here" ? <p className="mt-1.5 text-[.8rem] text-good">Checked: all here</p> : null}
      {order.checkStatus === "problem" ? <p className="mt-1.5 text-[.8rem] text-bad">A problem was reported</p> : null}
    </Frame>
  );
}

function ProductCardView({ card, product, onChange }: { card: Extract<AiCard, { kind: "ai_product" }>; product: AiProduct; onChange: Change }) {
  const [qty, setQty] = useState(product.suggestedQty && product.suggestedQty > 0 ? product.suggestedQty : 1);
  const added = useRef(0);
  const { busy, result, run } = useCardRun(() => onChange({ ...card, product: { ...product, inCart: product.inCart + added.current, added: false } }));
  const soldOut = product.available !== null && product.available <= 0;
  const stock = product.available === null ? "Stock to be confirmed" : soldOut ? "Out of stock" : `${product.available} available`;
  return (
    <Frame
      href={`/buyer/products?q=${encodeURIComponent(product.name)}`}
      lead={<ProductImage art={product.art} category={product.category} name={product.name} size="sm" decorative className="rounded-xl" />}
      title={product.name}
      sub={`${product.supplier} · ${stock}`}
      pill={
        <span className="flex-none text-right">
          <b className="block tabular-nums">{formatMoney(product.priceCents)}</b>
          <span className="text-[.75rem] text-muted">per {product.unit}</span>
        </span>
      }
      actions={
        soldOut ? null : (
          <>
            <Stepper value={qty} onChange={setQty} productLabel={product.name} />
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                added.current = qty;
                run("add_to_cart", { items: [{ product_id: product.id, qty }] });
              }}
            >
              {busy ? "Adding..." : `Add · ${formatMoney(product.priceCents * qty)}`}
            </Button>
            <TwoStepButton
              tone="default"
              label="Order now"
              confirmLabel={`Tap again to order · ${formatMoney(product.priceCents * qty)}`}
              busy={busy}
              onConfirm={() => {
                added.current = 0;
                run("order_now", { items: [{ product_id: product.id, qty }] });
              }}
            />
          </>
        )
      }
      result={result}
      notice={product.added ? `Added. ${product.supplier} confirms the price and stock.` : null}
    >
      {product.note || product.inCart > 0 ? (
        <p className="flex flex-wrap gap-x-3 text-[.8rem]">
          {product.note ? <span className="text-warn">{product.note}</span> : null}
          {product.inCart > 0 ? <span className="text-muted">{product.inCart} in your cart</span> : null}
        </p>
      ) : null}
    </Frame>
  );
}

const HEALTH: Record<AiStock["health"], { label: string; tone: PillTone }> = {
  healthy: { label: "In stock", tone: "good" },
  low: { label: "Low", tone: "warn" },
  out: { label: "Out", tone: "bad" },
  unconfirmed: { label: "To confirm", tone: "plain" },
};

function StockCardView({ card, stock, onChange }: { card: Extract<AiCard, { kind: "ai_stock" }>; stock: AiStock; onChange: Change }) {
  const unconfirmed = stock.health === "unconfirmed";
  const [mode, setMode] = useState<"none" | "receive" | "price" | "confirm" | "adjust">("none");
  const [value, setValue] = useState("");
  const [price, setPrice] = useState((stock.priceCents / 100).toFixed(2));
  const [reason, setReason] = useState<"damaged" | "expired" | "count_correction">("damaged");
  const [direction, setDirection] = useState<-1 | 1>(-1);
  const change = useRef<Partial<AiStock>>({});
  const { busy, result, run } = useCardRun((_message, next) =>
    onChange(next && next.kind === "ai_stock" ? { ...next, key: card.key } : { ...card, stock: { ...stock, ...change.current, added: false } }),
  );
  const number = Number(value);
  const whole = Number.isInteger(number) && number > 0;
  const valid = mode === "price" ? number > 0 : mode === "confirm" ? whole && Number(price) > 0 : whole;
  const submit = () => {
    if (!valid) return;
    if (mode === "confirm") {
      run("confirm_stock", { product_id: stock.id, qty: number, price: Number(price), reorder: stock.reorderLevel > 0 ? stock.reorderLevel : 5 });
    } else if (mode === "adjust") {
      run("adjust_stock", { product_id: stock.id, change: direction * number, reason });
    } else if (mode === "receive") {
      change.current = { onHand: stock.onHand + number, available: stock.available + number, health: stock.available + number > stock.reorderLevel ? "healthy" : stock.health };
      run("receive_stock", { product_id: stock.id, qty: number });
    } else {
      change.current = { priceCents: Math.round(number * 100) };
      run("change_price", { product_id: stock.id, price: number });
    }
  };
  return (
    <Frame
      href={`/supplier/inventory?q=${encodeURIComponent(stock.name)}`}
      lead={
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="stock" size={18} />
        </span>
      }
      title={stock.name}
      sub={`${stock.sku} · ${formatMoney(stock.priceCents)} per ${stock.unit}`}
      pill={<Pill tone={HEALTH[stock.health].tone}>{HEALTH[stock.health].label}</Pill>}
      notice={stock.added ? "Added to your inventory. Buyers can order it now." : null}
      actions={
        mode === "none" ? (
          unconfirmed ? (
            <>
              <Button variant="primary" onClick={() => setMode("confirm")}>
                Confirm price and stock
              </Button>
              <span className="text-[.8rem] text-muted">A buyer added this. Confirm it before you accept orders for it.</span>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={() => setMode("receive")}>
                Receive stock
              </Button>
              <Button onClick={() => setMode("price")}>Change price</Button>
              <Button onClick={() => setMode("adjust")}>Adjust</Button>
            </>
          )
        ) : (
          <form
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {mode === "adjust" ? (
              <>
                <select
                  aria-label="Remove or add"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value === "1" ? 1 : -1)}
                  className="rounded-lg border border-control-line bg-surface px-2 py-1.5 text-[.875rem] text-ink"
                >
                  <option value={-1}>Remove</option>
                  <option value={1}>Add back</option>
                </select>
                <select
                  aria-label="Reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value as typeof reason)}
                  className="rounded-lg border border-control-line bg-surface px-2 py-1.5 text-[.875rem] text-ink"
                >
                  <option value="damaged">Damaged</option>
                  <option value="expired">Expired</option>
                  <option value="count_correction">Count correction</option>
                </select>
              </>
            ) : null}
            {mode === "confirm" ? (
              <label className="flex items-center gap-2 text-[.875rem]">
                Price S$
                <input
                  inputMode="decimal"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="w-20 rounded-lg border border-control-line bg-surface px-2.5 py-1.5 tabular-nums text-ink"
                />
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-[.875rem]">
              {mode === "receive" ? `Add ${stock.unit}s` : mode === "price" ? "New price S$" : mode === "confirm" ? "In stock" : "How many"}
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-24 rounded-lg border border-control-line bg-surface px-2.5 py-1.5 tabular-nums text-ink"
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy || !valid}>
              {busy ? "Saving..." : mode === "receive" ? "Add stock" : mode === "price" ? "Save price" : mode === "confirm" ? "Confirm stock" : "Adjust stock"}
            </Button>
            <Button onClick={() => setMode("none")} disabled={busy}>
              Back
            </Button>
          </form>
        )
      }
      result={result}
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["On hand", stock.onHand],
          ["Reserved", stock.reserved],
          ["Available", stock.available],
        ].map(([label, amount]) => (
          <div key={label} className="rounded-xl bg-sunken px-2 py-1.5">
            <dt className="text-[.72rem] text-muted">{label}</dt>
            <dd className="font-semibold tabular-nums">{amount}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1.5 text-[.75rem] text-muted">Reorder at {stock.reorderLevel}</p>
    </Frame>
  );
}

const PROBLEM_WORDS: Record<string, string> = { short: "Short", damaged: "Damaged", wrong_item: "Wrong item", expired: "Expired" };

function ProblemCardView({ problem }: { problem: AiProblem }) {
  const { busy, result, run } = useCardRun(() => undefined);
  const answer = (value: string) => run("answer_problem", { issue_id: problem.id, answer: value });
  return (
    <Frame
      href="/supplier/orders#problems"
      lead={<BusinessLogo name={problem.buyer} size={36} />}
      title={`${problem.buyer} · ${orderNumber(problem.orderNumber)}`}
      sub={`${problem.qty} × ${problem.item}`}
      pill={<Pill tone="bad">{PROBLEM_WORDS[problem.type] ?? problem.type}</Pill>}
      actions={
        <>
          <Button variant="primary" disabled={busy} onClick={() => answer("credit")}>
            Credit {formatMoney(problem.amountCents)}
          </Button>
          <Button disabled={busy} onClick={() => answer("replace")}>
            Replace next delivery
          </Button>
          <Button disabled={busy} onClick={() => answer("on_the_way")}>
            It is on the way
          </Button>
          <TwoStepButton label="Dispute" confirmLabel="Tap again to dispute" busy={busy} onConfirm={() => answer("dispute")} />
        </>
      }
      result={result}
    >
      {problem.note ? <p className="text-[.875rem] text-muted">&ldquo;{problem.note}&rdquo;</p> : null}
    </Frame>
  );
}

const ALERT_ICONS: Record<AiAlert["kind"], IconName> = { price: "trend", partial: "truck", reply: "chat", credit: "receipt" };

function AlertCardView({ alert }: { alert: AiAlert }) {
  const { busy, result, run } = useCardRun(() => undefined);
  let actions: ReactNode = (
    <Link href="/buyer/notifications" className="text-[.875rem] font-semibold text-accent">
      Open alerts
    </Link>
  );
  if (alert.kind === "price") {
    actions = (
      <Button variant="primary" disabled={busy} onClick={() => run("acknowledge_price_change", { price_change_id: alert.id })}>
        OK, noted
      </Button>
    );
  } else if (alert.kind === "credit") {
    actions = (
      <Button variant="primary" disabled={busy} onClick={() => run("mark_credit_received", { issue_id: alert.id })}>
        Mark credit received
      </Button>
    );
  }
  const tones = { good: "bg-good-soft text-good", warn: "bg-warn-soft text-warn", bad: "bg-bad-soft text-bad" };
  return (
    <Frame
      lead={
        <span className={cx("grid size-9 flex-none place-items-center rounded-xl", tones[alert.tone])}>
          <Icon name={ALERT_ICONS[alert.kind]} size={18} />
        </span>
      }
      title={alert.title}
      sub={alert.detail}
      actions={actions}
      result={result}
    />
  );
}

const CART_SHOWN = 6;

/** A line asks for more than the supplier has free right now. */
const shortBy = (line: AiCartLine) => (line.available !== null && line.qty > line.available ? line.available : null);

function CartCardView({ card, cart, onChange }: { card: Extract<AiCard, { kind: "ai_cart" }>; cart: AiCart; onChange: Change }) {
  const edit = useCardRun((_message, next) => next && onChange({ ...next, key: card.key }));
  const place = useCardRun(() => undefined);
  const [open, setOpen] = useState(false);
  const empty = cart.lines.length === 0;
  const short = cart.lines.filter((line) => shortBy(line) !== null);
  const blocked = cart.unresolved + short.length;
  const busy = edit.busy || place.busy;
  const setQty = (productId: string, qty: number) => edit.run("set_cart_quantity", { product_id: productId, qty });

  // One group per supplier, which is how the cart splits into orders.
  const groups = new Map<string, { lines: { line: AiCartLine; index: number }[]; cents: number }>();
  cart.lines.forEach((line, index) => {
    const name = line.supplier ?? "Needs a product";
    const group = groups.get(name) ?? { lines: [], cents: 0 };
    group.lines.push({ line, index });
    group.cents += line.lineCents ?? 0;
    groups.set(name, group);
  });
  let shown = 0;

  return (
    <Frame
      href="/buyer/cart"
      lead={
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="cart" size={18} />
        </span>
      }
      title="Your cart"
      sub={empty ? "Empty" : `${cart.lines.length} ${cart.lines.length === 1 ? "item" : "items"} · ${cart.suppliers} ${cart.suppliers === 1 ? "supplier" : "suppliers"}`}
      pill={empty ? null : <b className="text-[1.05rem] tabular-nums">{formatMoney(cart.totalCents)}</b>}
      actions={
        empty ? null : (
          <>
            <Button variant="primary" disabled={busy || blocked > 0} onClick={() => place.run("place_order", { cart_version: cart.version })}>
              {place.busy ? "Placing..." : `${cart.suppliers > 1 ? `Place ${cart.suppliers} orders` : "Place order"} · ${formatMoney(cart.totalCents)}`}
            </Button>
            {blocked > 0 ? (
              <span className="text-[.8rem] text-warn">
                Fix {blocked === 1 ? "the item" : `${blocked} items`} marked below first
              </span>
            ) : null}
            {edit.result && !edit.result.ok ? <span className="text-[.8rem] text-bad">{edit.result.text}</span> : null}
          </>
        )
      }
      result={place.result}
    >
      {empty ? (
        <p className="text-[.875rem] text-muted">Nothing in your cart yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {[...groups].map(([supplier, group]) => {
            const visible = group.lines.filter(() => open || shown++ < CART_SHOWN);
            if (visible.length === 0) return null;
            return (
              <section key={supplier} aria-label={supplier} className="overflow-hidden rounded-xl border border-line">
                <header className="flex items-center justify-between gap-2 bg-sunken/60 px-2.5 py-1.5 text-[.75rem] font-semibold text-muted">
                  <span className="truncate">{supplier}</span>
                  <span className="tabular-nums">{formatMoney(group.cents)}</span>
                </header>
                <ul className="divide-y divide-line">
                  {visible.map(({ line, index }) => {
                    const free = shortBy(line);
                    return (
                      <li key={index} className={cx("px-2.5 py-1.5", free !== null && "bg-warn-soft/40")}>
                        <div className="flex items-center gap-2">
                          {line.productId ? (
                            <MiniStepper
                              value={line.qty}
                              min={0}
                              max={line.available}
                              label={line.name}
                              busy={busy}
                              onChange={(value) => line.productId && setQty(line.productId, value)}
                            />
                          ) : (
                            <span className="min-w-[4.5rem] text-center text-[.85rem] tabular-nums text-muted">{line.qty}</span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-[.9rem]">{line.name}</span>
                          <span className="flex-none text-[.85rem] tabular-nums text-muted">
                            {line.lineCents === null ? "" : formatMoney(line.lineCents)}
                          </span>
                        </div>
                        {free !== null && line.productId ? (
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 pl-[5.25rem] text-[.8rem] text-warn">
                            {free === 0 ? "Out of stock now." : `Only ${free} available.`}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => line.productId && setQty(line.productId, free)}
                              className="font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-50"
                            >
                              {free === 0 ? "Remove it" : `Use ${free}`}
                            </button>
                          </p>
                        ) : null}
                        {!line.productId ? (
                          <p className="mt-1 pl-[5.25rem] text-[.8rem] text-warn">
                            <Link href="/buyer/cart" className="font-semibold text-accent">
                              Choose the product in your cart
                            </Link>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {cart.lines.length > CART_SHOWN ? (
            <button type="button" onClick={() => setOpen(!open)} className="self-start text-[.85rem] font-semibold text-accent">
              {open ? "Show less" : `Show all ${cart.lines.length} items`}
            </button>
          ) : null}
        </div>
      )}
    </Frame>
  );
}

function SpendCardView({ spend }: { spend: { spentCents: number; budgetCents: number } }) {
  const share = spend.budgetCents > 0 ? spend.spentCents / spend.budgetCents : 0;
  const tone = share > 1 ? "bg-bad" : share > 0.8 ? "bg-warn" : "bg-accent";
  return (
    <Frame
      href="/buyer/insights"
      lead={
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="receipt" size={18} />
        </span>
      }
      title={`${formatMoney(spend.spentCents)} spent this week`}
      sub={
        share > 1
          ? `${formatMoney(spend.spentCents - spend.budgetCents)} over your ${formatMoney(spend.budgetCents)} budget`
          : `${formatMoney(spend.budgetCents - spend.spentCents)} left of ${formatMoney(spend.budgetCents)}`
      }
    >
      <div className="h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${Math.round(share * 100)}% of the weekly budget`}>
        <div className={cx("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.round(share * 100))}%` }} />
      </div>
    </Frame>
  );
}

function SupplierCardView({ supplier }: { supplier: AiSupplier }) {
  const tone: PillTone = supplier.onTimePercent === null ? "plain" : supplier.onTimePercent >= 90 ? "good" : supplier.onTimePercent >= 70 ? "warn" : "bad";
  return (
    <Frame
      lead={<BusinessLogo name={supplier.name} size={36} />}
      title={supplier.name}
      sub={
        supplier.invited
          ? "Not on Tradelink yet"
          : [supplier.cutOff ? `Cut-off ${supplier.cutOff}` : null, supplier.deliveryDays].filter(Boolean).join(" · ") || "No terms set"
      }
      pill={
        <Pill tone={supplier.invited ? "plain" : tone}>
          {supplier.invited ? "Invited" : supplier.onTimePercent === null ? "New" : `${supplier.onTimePercent}% on time`}
        </Pill>
      }
      notice={supplier.invited ? "Added. Ask Tradelink AI to add their products." : null}
    >
      {supplier.invited ? null : (
        <p className="text-[.8rem] text-muted">
          {supplier.deliveries === 0 ? "No deliveries yet" : `Based on ${supplier.deliveries} ${supplier.deliveries === 1 ? "delivery" : "deliveries"}`}
        </p>
      )}
    </Frame>
  );
}

const inputClass = "w-full rounded-lg border border-control-line bg-surface px-2.5 py-1.5 text-[.9rem] text-ink";

function FormField({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={cx("flex flex-col gap-1 text-[.75rem] font-medium text-muted", wide && "col-span-2")}>
      {label}
      {children}
    </label>
  );
}

const NEW_SUPPLIER = "new";

function NewProductCardView({ card, form, onChange }: { card: Extract<AiCard, { kind: "ai_new_product" }>; form: AiNewProduct; onChange: Change }) {
  const supplierView = card.view === "supplier";
  const [name, setName] = useState(form.name);
  const [unit, setUnit] = useState(form.unit ?? "");
  const [price, setPrice] = useState(form.priceCents === null ? "" : (form.priceCents / 100).toFixed(2));
  const [supplier, setSupplier] = useState(form.supplierId ?? (form.newSupplier || form.suppliers.length === 0 ? NEW_SUPPLIER : ""));
  const [newSupplier, setNewSupplier] = useState(form.newSupplier ?? "");
  const [category, setCategory] = useState(form.category ?? "");
  const [opening, setOpening] = useState(String(form.opening ?? 0));
  const [reorder, setReorder] = useState(String(form.reorder ?? 5));
  const { busy, result, run } = useCardRun((_message, next) => next && onChange({ ...next, key: card.key }));

  const amount = Number(price);
  const whole = (value: string) => /^\d{1,5}$/.test(value);
  const missing = [
    name.trim().length < 2 && "a name",
    !unit && "a unit",
    !(amount > 0) && "a price",
    !supplierView && supplier === "" && "a supplier",
    !supplierView && supplier === NEW_SUPPLIER && newSupplier.trim().length < 2 && "the supplier's name",
    supplierView && !category && "a category",
    supplierView && !(whole(opening) && whole(reorder)) && "stock numbers",
  ].filter((entry): entry is string => Boolean(entry));

  const submit = () => {
    if (missing.length > 0) return;
    const base = { name: name.trim(), unit, price: amount };
    run(
      "add_product",
      supplierView
        ? { ...base, category, opening: Number(opening), reorder: Number(reorder) }
        : supplier === NEW_SUPPLIER
          ? { ...base, new_supplier: newSupplier.trim() }
          : { ...base, supplier_id: supplier },
    );
  };

  return (
    <Frame
      lead={
        <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon name="box" size={18} />
        </span>
      }
      title="New product"
      sub={supplierView ? "Added to your inventory" : supplier === NEW_SUPPLIER && newSupplier.trim() ? `Adds ${newSupplier.trim()} as a new supplier too` : "The supplier confirms the price and stock"}
      actions={
        <>
          <Button variant="primary" disabled={busy || missing.length > 0} onClick={submit}>
            {busy ? "Adding..." : supplier === NEW_SUPPLIER && !supplierView ? "Add product and supplier" : "Add product"}
          </Button>
          {missing.length > 0 ? <span className="text-[.8rem] text-muted">Add {missing.join(", ")}</span> : null}
        </>
      }
      result={result && !result.ok ? result : null}
    >
      <form
        className="grid grid-cols-2 gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField label="Product name" wide>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className={inputClass} />
        </FormField>
        <FormField label="Unit">
          <select value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass}>
            <option value="">Choose</option>
            {UNITS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={supplierView ? "Price (S$)" : "Estimated price (S$)"}>
          <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="0.00" className={cx(inputClass, "tabular-nums")} />
        </FormField>
        {supplierView ? (
          <>
            <FormField label="Category" wide>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                <option value="">Choose</option>
                {CATEGORIES.map((entry) => (
                  <option key={entry} value={entry}>
                    {CATEGORY_LABELS[entry]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Opening stock">
              <input value={opening} onChange={(event) => setOpening(event.target.value)} inputMode="numeric" className={cx(inputClass, "tabular-nums")} />
            </FormField>
            <FormField label="Reorder at">
              <input value={reorder} onChange={(event) => setReorder(event.target.value)} inputMode="numeric" className={cx(inputClass, "tabular-nums")} />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Supplier" wide>
              <select value={supplier} onChange={(event) => setSupplier(event.target.value)} className={inputClass}>
                {form.suppliers.length > 0 ? <option value="">Choose</option> : null}
                {form.suppliers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
                <option value={NEW_SUPPLIER}>New supplier</option>
              </select>
            </FormField>
            {supplier === NEW_SUPPLIER ? (
              <FormField label="New supplier's name" wide>
                <input value={newSupplier} onChange={(event) => setNewSupplier(event.target.value)} maxLength={120} className={inputClass} />
              </FormField>
            ) : null}
          </>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Frame>
  );
}

function NewSupplierCardView({ card, form, onChange }: { card: Extract<AiCard, { kind: "ai_new_supplier" }>; form: AiNewSupplier; onChange: Change }) {
  const [name, setName] = useState(form.name);
  const [contact, setContact] = useState(form.contact ?? "");
  const [phone, setPhone] = useState(form.phone ?? "");
  const { busy, result, run } = useCardRun((_message, next) => next && onChange({ ...next, key: card.key }));
  const phoneOk = phone.trim() === "" || /^\+?[0-9 ]{8,16}$/.test(phone.trim());
  const ready = name.trim().length >= 2 && phoneOk;
  const submit = () => {
    if (!ready) return;
    run("add_supplier", {
      name: name.trim(),
      ...(contact.trim() ? { contact: contact.trim() } : {}),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    });
  };
  return (
    <Frame
      lead={<BusinessLogo name={name || "New supplier"} size={36} />}
      title="New supplier"
      sub="Tradelink invites them; you can add their products straight away"
      actions={
        <>
          <Button variant="primary" disabled={busy || !ready} onClick={submit}>
            {busy ? "Adding..." : "Add supplier"}
          </Button>
          {!phoneOk ? <span className="text-[.8rem] text-warn">Phone needs 8 to 16 digits</span> : null}
        </>
      }
      result={result && !result.ok ? result : null}
    >
      <form
        className="grid grid-cols-2 gap-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField label="Supplier name" wide>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className={inputClass} />
        </FormField>
        <FormField label="Contact name (optional)">
          <input value={contact} onChange={(event) => setContact(event.target.value)} maxLength={120} className={inputClass} />
        </FormField>
        <FormField label="Phone (optional)">
          <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" className={cx(inputClass, "tabular-nums")} />
        </FormField>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Frame>
  );
}

/** One Tradelink AI card, with its own buttons and a link to where it lives in the app. */
export function AiCardView({ card, onChange }: { card: AiCard; onChange: Change }) {
  switch (card.kind) {
    case "ai_order":
      return <OrderCardView card={card} order={card.order} onChange={onChange} />;
    case "ai_product":
      return <ProductCardView card={card} product={card.product} onChange={onChange} />;
    case "ai_stock":
      return <StockCardView card={card} stock={card.stock} onChange={onChange} />;
    case "ai_problem":
      return <ProblemCardView problem={card.problem} />;
    case "ai_alert":
      return <AlertCardView alert={card.alert} />;
    case "ai_cart":
      return <CartCardView card={card} cart={card.cart} onChange={onChange} />;
    case "ai_spend":
      return <SpendCardView spend={card.spend} />;
    case "ai_supplier":
      return <SupplierCardView supplier={card.supplier} />;
    case "ai_new_product":
      return <NewProductCardView card={card} form={card.form} onChange={onChange} />;
    case "ai_new_supplier":
      return <NewSupplierCardView card={card} form={card.form} onChange={onChange} />;
  }
}
