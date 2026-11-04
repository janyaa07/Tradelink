import Link from "next/link";
import { plural } from "@/domain/catalogue";
import { DateRequestButtons } from "@/features/orders/DateRequestButtons";
import type { OpenDateRequest, UnansweredMessage } from "@/features/orders/requests";
import { LinkButton } from "@/ui/LinkButton";
import { formatDate, orderNumber } from "@/ui/format";
import { Icon } from "@/ui/Icon";

type Props = { dateRequests: OpenDateRequest[]; messages: UnansweredMessage[]; newOrders: number; problems: number };

const rowClass = "flex min-w-0 items-start gap-3 border-t border-line px-4 py-3.5 first:border-t-0";
const iconClass = "grid size-8 flex-none place-items-center rounded-[9px] bg-warn-soft text-warn";

/** What needs the supplier in the bell's pop-up: buyers' date changes to answer, new orders and problems. */
export function SupplierBellActions({ dateRequests, messages, newOrders, problems }: Props) {
  return (
    <ul className="flex flex-col">
      {messages.map((message) => (
        <li key={message.orderId} className={rowClass}>
          <span className={iconClass}>
            <Icon name="chat" size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[.875rem] font-semibold">
                {message.fromName} wrote about {orderNumber(message.orderNumber)}
              </p>
              <p className="line-clamp-2 text-[.8rem] text-muted">&ldquo;{message.body}&rdquo;</p>
            </div>
            <div>
              <LinkButton href={`/supplier/orders/${message.orderId}#messages`} variant="primary" size="small">
                Reply
              </LinkButton>
            </div>
          </div>
        </li>
      ))}
      {dateRequests.map((request) => (
        <li key={request.id} className={rowClass}>
          <span className={iconClass}>
            <Icon name="truck" size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-[.875rem] font-semibold">
                {request.fromName} asks to move {request.rest ? "the rest of " : ""}
                {orderNumber(request.orderNumber)}
              </p>
              <p className="text-[.8rem] text-muted">
                To {formatDate(request.proposedDate)}.{request.note ? ` "${request.note}"` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <DateRequestButtons requestId={request.id} />
              <Link
                href={`/supplier/orders/${request.orderId}`}
                aria-label={`Open ${orderNumber(request.orderNumber)}`}
                className="grid size-8 place-items-center rounded-md text-muted no-underline hover:bg-sunken hover:text-ink"
              >
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </li>
      ))}
      {newOrders > 0 ? (
        <li className={rowClass}>
          <span className={iconClass}>
            <Icon name="list" size={16} />
          </span>
          <Link href="/supplier/orders?filter=new" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-ink no-underline">
            <span className="text-[.875rem] font-semibold">{plural(newOrders, "new order")} to accept</span>
            <Icon name="arrow" size={16} className="text-muted" />
          </Link>
        </li>
      ) : null}
      {problems > 0 ? (
        <li className={rowClass}>
          <span className="grid size-8 flex-none place-items-center rounded-[9px] bg-bad-soft text-bad">
            <Icon name="flag" size={16} />
          </span>
          <Link href="/supplier/orders#problems" className="flex min-w-0 flex-1 items-center justify-between gap-2 text-ink no-underline">
            <span className="text-[.875rem] font-semibold">{plural(problems, "problem")} to answer</span>
            <Icon name="arrow" size={16} className="text-muted" />
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
