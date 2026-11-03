"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { AiAlert, AiCard, AiCart, AiOrder, AiProblem, AiProduct, AiStock, AiSupplier } from "@/domain/ask/types";
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
function useCardRun(onDone: (message: string) => void) {
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
        onDone(outcome.data);
        router.refresh();
      } else {
        setResult({ ok: false, text: outcome.error });
      }
    });
  return { busy, result, run };
}

/** Asks for a second tap before anything that is hard to undo, such as Cancel or Reject. */
function TwoStepButton({ label, confirmLabel, busy, onConfirm }: { label: string; confirmLabel: string; busy: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant="danger"
      disabled={busy}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
      className={cx(armed && "border-bad bg-bad-soft")}
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
}: {
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
  const { busy, result, run } = useCardRun(() => update(pendingChange.current));
  const act = (tool: string, change: Partial<AiOrder>, args: Record<string, unknown> = {}) => {
    pendingChange.current = change;
    run(tool, { order_number: order.number, order_id: order.id, ...args });
  };
  const tomorrow = sgDate(1);
  const [date, setDate] = useState(order.deliveryDate && order.deliveryDate > tomorrow ? order.deliveryDate : tomorrow);
  const dateChoices = [tomorrow, sgDate(2)];
  const [otherDate, setOtherDate] = useState(false);

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
        <Button variant="primary" disabled={busy} onClick={() => act("accept_order", { status: "accepted", deliveryDate: date }, { delivery_date: date })}>
          {busy ? "Accepting..." : `Accept for ${formatDate(date)}`}
        </Button>
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
      <div className="flex items-end justify-between gap-3">
        <Lines lines={order.lines} />
        <b className="flex-none tabular-nums">{formatMoney(order.totalCents)}</b>
      </div>
      {order.checkStatus === "all_here" ? <p className="mt-1.5 text-[.8rem] text-good">Checked: all here</p> : null}
      {order.checkStatus === "problem" ? <p className="mt-1.5 text-[.8rem] text-bad">A problem was reported</p> : null}
    </Frame>
  );
}

function ProductCardView({ card, product, onChange }: { card: Extract<AiCard, { kind: "ai_product" }>; product: AiProduct; onChange: Change }) {
  const [qty, setQty] = useState(product.suggestedQty && product.suggestedQty > 0 ? product.suggestedQty : 1);
  const added = useRef(0);
  const { busy, result, run } = useCardRun(() => onChange({ ...card, product: { ...product, inCart: product.inCart + added.current } }));
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
          </>
        )
      }
      result={result}
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
  const [mode, setMode] = useState<"none" | "receive" | "price">("none");
  const [value, setValue] = useState("");
  const change = useRef<Partial<AiStock>>({});
  const { busy, result, run } = useCardRun(() => onChange({ ...card, stock: { ...stock, ...change.current } }));
  const number = Number(value);
  const valid = mode === "receive" ? Number.isInteger(number) && number > 0 : number > 0;
  const submit = () => {
    if (!valid) return;
    if (mode === "receive") {
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
      actions={
        mode === "none" ? (
          <>
            <Button variant="primary" onClick={() => setMode("receive")}>
              Receive stock
            </Button>
            <Button onClick={() => setMode("price")}>Change price</Button>
          </>
        ) : (
          <form
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="flex items-center gap-2 text-[.875rem]">
              {mode === "receive" ? `Add ${stock.unit}s` : "New price S$"}
              <input
                autoFocus
                inputMode="decimal"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="w-24 rounded-lg border border-control-line bg-surface px-2.5 py-1.5 tabular-nums text-ink"
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy || !valid}>
              {busy ? "Saving..." : mode === "receive" ? "Add stock" : "Save price"}
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

function CartCardView({ cart }: { cart: AiCart }) {
  const { busy, result, run } = useCardRun(() => undefined);
  const empty = cart.lines.length === 0;
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
      pill={empty ? null : <b className="tabular-nums">{formatMoney(cart.totalCents)}</b>}
      actions={
        empty ? null : cart.unresolved > 0 ? (
          <span className="text-[.875rem] text-warn">
            {cart.unresolved} {cart.unresolved === 1 ? "line needs" : "lines need"} a product chosen in the cart first.
          </span>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => run("place_order", { cart_version: cart.version })}>
            {busy ? "Placing..." : cart.suppliers > 1 ? `Place ${cart.suppliers} orders` : "Place order"}
          </Button>
        )
      }
      result={result}
    >
      {empty ? null : (
        <ul className="flex flex-col gap-0.5 text-[.9rem]">
          {cart.lines.slice(0, 6).map((line, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="tabular-nums text-muted">{line.qty}×</span> {line.name}
              </span>
              <span className="flex-none tabular-nums text-muted">{line.lineCents === null ? "Choose" : formatMoney(line.lineCents)}</span>
            </li>
          ))}
          {cart.lines.length > 6 ? <li className="text-[.8rem] text-muted">+{cart.lines.length - 6} more</li> : null}
        </ul>
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
      sub={[supplier.cutOff ? `Cut-off ${supplier.cutOff}` : null, supplier.deliveryDays].filter(Boolean).join(" · ") || "No terms set"}
      pill={
        <Pill tone={tone}>
          {supplier.onTimePercent === null ? "New" : `${supplier.onTimePercent}% on time`}
        </Pill>
      }
    >
      <p className="text-[.8rem] text-muted">
        {supplier.deliveries === 0 ? "No deliveries yet" : `Based on ${supplier.deliveries} ${supplier.deliveries === 1 ? "delivery" : "deliveries"}`}
      </p>
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
      return <CartCardView cart={card.cart} />;
    case "ai_spend":
      return <SpendCardView spend={card.spend} />;
    case "ai_supplier":
      return <SupplierCardView supplier={card.supplier} />;
  }
}
