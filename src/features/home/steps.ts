import "server-only";
import { getCatalogue } from "@/data/catalogue";
import { plural } from "@/domain/catalogue";
import { customerPulse, minutesToCutoff, pickList, usualDay } from "@/domain/home";
import { formatMoney } from "@/domain/money";
import { singaporeClockOf, singaporeDateOf } from "@/domain/singapore-time";
import type { Todo } from "@/domain/todos";
import { getDeliveriesToCheck } from "@/features/buyer/queries";
import { getReorderPlan } from "@/features/buyer/reorder-plan";
import { getTodos } from "@/features/buyer/todo-queries";
import { getOrders, OPEN_STATUSES, type OrderView } from "@/features/orders/queries";
import { getBusinessProfile, getOpenIssues } from "@/features/supplier/queries";
import { inventoryHref, needsReorder } from "@/features/supplier/stock";
import { orderNumber } from "@/ui/format";
import type { StepTone } from "./HomeParts";

/**
 * What needs the person, most important first: the Next up card on Home and "What I can see right
 * now" on Tradelink AI read the same list. subject is a short noun phrase for the briefing line.
 */
type StepBase = {
  key: string;
  title: string;
  subject: string;
  detail: string;
  href: string;
  tone: StepTone;
};

export type BuyerStep = StepBase & ({ kind: "plan" } | { kind: "delivery"; order: OrderView } | { kind: "todo"; todo: Todo });

export type SupplierStep = StepBase & ({ kind: "accept"; orders: OrderView[] } | { kind: "pack"; orders: OrderView[] } | { kind: "other" });

const TODO_TONES: Record<Todo["tone"], StepTone> = {
  good: "good",
  warn: "warn",
  bad: "bad",
};

const TODO_SUBJECTS: Record<Todo["action"]["kind"], string> = {
  price: "a price change",
  partial: "a part delivery",
  reply: "a reply about a problem",
  credit: "a credit to confirm",
};

/** The buyer's steps: tomorrow's order, deliveries to check and alerts. Deliveries come first in the morning. */
export async function loadBuyerSteps(orgId: string, now: Date) {
  const [todos, plan, deliveries] = await Promise.all([getTodos(orgId), getReorderPlan(orgId), getDeliveriesToCheck(orgId)]);
  const planStep: BuyerStep[] =
    plan.rows.length > 0
      ? [
          {
            key: "plan",
            kind: "plan",
            title: "Place tomorrow's order",
            subject: "tomorrow's order",
            detail: `${plural(plan.rows.length, "item")}, ${formatMoney(plan.totalCents)}`,
            href: "/buyer/cart",
            tone: "warn",
          },
        ]
      : [];
  const deliverySteps: BuyerStep[] = deliveries
    .filter((order) => order.status === "delivered")
    .map((order) => ({
      key: `delivery-${order.id}`,
      kind: "delivery",
      order,
      title: `Check ${orderNumber(order.number)}`,
      subject: `${orderNumber(order.number)} to check`,
      detail: `${order.supplier.name} delivered it`,
      href: `/buyer/orders/${order.id}`,
      tone: "warn",
    }));
  const todoSteps: BuyerStep[] = todos.map((todo) => ({
    key: todo.key,
    kind: "todo",
    todo,
    title: todo.title,
    subject: TODO_SUBJECTS[todo.action.kind],
    detail: todo.detail,
    href: todo.orderId ? `/buyer/orders/${todo.orderId}` : "/buyer/notifications",
    tone: TODO_TONES[todo.tone],
  }));
  const morning = singaporeClockOf(now).minutes < 12 * 60;
  const steps = morning ? [...deliverySteps, ...planStep, ...todoSteps] : [...planStep, ...deliverySteps, ...todoSteps];
  return { steps, todos, plan, deliveries };
}

export const orderDeliveryDate = (order: OrderView) => order.confirmedDeliveryDate ?? order.requestedDeliveryDate ?? "";

/** The supplier's steps: accept, pack, answer problems, receive stock that ran out, then buyers going quiet. */
export async function loadSupplierSteps(orgId: string, now: Date) {
  const [openOrders, recentOrders, catalogue, issues, profile] = await Promise.all([
    getOrders({ supplierOrgId: orgId, statuses: OPEN_STATUSES, limit: 200 }),
    getOrders({ supplierOrgId: orgId, limit: 300 }),
    getCatalogue({ supplierOrgId: orgId }),
    getOpenIssues(orgId),
    getBusinessProfile(orgId),
  ]);
  const today = singaporeDateOf(now);
  const pending = openOrders.filter((order) => order.status === "pending");
  const packToday = openOrders.filter((order) => order.status === "accepted" && orderDeliveryDate(order) <= today);
  const comingUp = openOrders.filter((order) => order.status === "accepted" && orderDeliveryDate(order) > today);
  const outOfStock = catalogue.filter((item) => item.health === "out");
  const lowStock = catalogue.filter(needsReorder);
  const placed = recentOrders.filter((order) => order.status !== "cancelled" && order.status !== "rejected");
  const pulse = customerPulse(
    placed.map((order) => ({
      buyer: order.buyer.name,
      createdAt: order.createdAt,
    })),
    now,
  );
  const quiet = pulse.filter((entry) => entry.kind === "quiet");
  const day = usualDay(
    placed.map((order) => ({
      createdAt: order.createdAt,
      totalCents: order.totalCents,
    })),
    now,
  );
  const picks = pickList(packToday.map((order) => ({ buyer: order.buyer.name, lines: order.lines })));
  const buyersOf = (orders: OrderView[]) => [...new Set(orders.map((order) => order.buyer.name))].join(", ");

  const steps: SupplierStep[] = [
    ...(pending.length > 0
      ? [
          {
            key: "accept",
            kind: "accept" as const,
            orders: pending,
            title: `Accept ${plural(pending.length, "new order")}`,
            subject: `${plural(pending.length, "new order")} to accept`,
            detail: buyersOf(pending),
            href: "/supplier/orders",
            tone: "warn" as const,
          },
        ]
      : []),
    ...(packToday.length > 0
      ? [
          {
            key: "pack",
            kind: "pack" as const,
            orders: packToday,
            title: `Pack today's ${plural(packToday.length, "order")}`,
            subject: `today's ${plural(packToday.length, "order")} to pack`,
            detail: buyersOf(packToday),
            href: "/supplier/orders#orders",
            tone: "info" as const,
          },
        ]
      : []),
    ...(issues.length > 0
      ? [
          {
            key: "issues",
            kind: "other" as const,
            title: `Answer ${plural(issues.length, "problem")}`,
            subject: `${plural(issues.length, "problem")} to answer`,
            detail: [...new Set(issues.map((issue) => issue.buyerName))].join(", "),
            href: "/supplier/orders#problems",
            tone: "bad" as const,
          },
        ]
      : []),
    ...outOfStock.map((item) => ({
      key: `out-${item.id}`,
      kind: "other" as const,
      title: `Receive stock for ${item.name}`,
      subject: `stock for ${item.name}`,
      detail: `${item.available} free, ${item.reserved} reserved`,
      href: inventoryHref({ q: item.name }),
      tone: "bad" as const,
    })),
    ...quiet.slice(0, 2).map((entry) => ({
      key: `quiet-${entry.buyer}`,
      kind: "other" as const,
      title: `${entry.buyer} is quiet`,
      subject: `${entry.buyer} going quiet`,
      detail: `${entry.daysSince} days since their last order, usually ${entry.usualGap}`,
      href: "/supplier/orders",
      tone: "warn" as const,
    })),
  ];
  return {
    steps,
    pending,
    packToday,
    comingUp,
    lowStock,
    pulse,
    day,
    picks,
    packCents: packToday.reduce((sum, order) => sum + order.totalCents, 0),
    cutoff: profile.cutoff.slice(0, 5),
    minutesLeft: minutesToCutoff(profile.cutoff, now),
  };
}
