import Link from "next/link";
import type { OrderView } from "@/features/orders/queries";
import { formatDate, orderNumber } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { Panel } from "@/ui/Panel";
import { Pill } from "@/ui/Pill";

const SHOWN = 4;

function stateOf(order: OrderView): { label: string; tone: "info" | "warn" } {
  return order.status === "out_for_delivery" ? { label: "On the way", tone: "info" } : { label: "To check", tone: "warn" };
}

/** Arriving and to check on Home: a short list of deliveries, each opening its order. */
export function ArrivingPanel({ deliveries }: { deliveries: OrderView[] }) {
  const shown = deliveries.slice(0, SHOWN);
  return (
    <Panel
      soft
      title="Arriving and to check"
      action={
        deliveries.length > 0 ? (
          <Link href="/buyer/orders?filter=to_check" className="text-[.875rem] font-semibold text-accent">
            See all<span className="sr-only"> deliveries to check</span>
          </Link>
        ) : undefined
      }
    >
      {shown.length > 0 ? (
        <ul className="-mx-1.5">
          {shown.map((order) => {
            const state = stateOf(order);
            const date = order.confirmedDeliveryDate ?? order.requestedDeliveryDate;
            return (
              <li key={order.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/buyer/orders/${order.id}`}
                  className="flex min-w-0 items-center gap-3 rounded-md px-1.5 py-2.5 text-ink no-underline hover:bg-sunken"
                >
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon name="truck" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{order.supplier.name}</span>
                    <span className="block text-[.8rem] text-muted">
                      <span className="font-mono">{orderNumber(order.number)}</span>
                      {date ? ` · ${formatDate(date)}` : ""}
                    </span>
                  </span>
                  <Pill tone={state.tone}>{state.label}</Pill>
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">Nothing on the way or waiting to be checked.</p>
      )}
    </Panel>
  );
}
