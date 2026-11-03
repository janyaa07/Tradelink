import Link from "next/link";
import type { Todo, TodoAction, TodoTone } from "@/domain/todos";
import { cx } from "@/ui/cx";
import { Icon, type IconName } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { TodoActions } from "./TodoActions";

const KINDS: Record<TodoAction["kind"], { label: string; icon: IconName }> = {
  price: { label: "Price change", icon: "trend" },
  partial: { label: "Part delivery", icon: "truck" },
  reply: { label: "Reply", icon: "chat" },
  credit: { label: "Credit", icon: "receipt" },
};

const ICON_TONES: Record<TodoTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

/**
 * One alert: what happened, in words, the buttons that settle it and, when it is about an order,
 * an arrow to that order. "card" stands alone on the alerts page; "row" sits in the bell's pop-up.
 */
function ActionAlertItem({ todo, variant }: { todo: Todo; variant: "card" | "row" }) {
  const kind = KINDS[todo.action.kind];
  return (
    <li
      className={cx(
        "flex min-w-0 gap-3",
        variant === "card" ? "rounded-2xl border border-line bg-surface p-3.5 shadow-card" : "border-b border-line px-3.5 py-3",
      )}
    >
      <span className={cx("grid size-10 flex-none place-items-center rounded-full", ICON_TONES[todo.tone])}>
        <Icon name={kind.icon} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="font-semibold">{todo.title}</b>
            <Pill tone={todo.tone}>{kind.label}</Pill>
          </div>
          <p className="text-[.875rem] text-muted">{todo.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TodoActions action={todo.action} />
        </div>
      </div>
      {todo.orderId ? (
        <Link
          href={`/buyer/orders/${todo.orderId}`}
          aria-label={`Open the order: ${todo.title}`}
          title="Open the order"
          className="grid size-9 flex-none place-items-center self-center rounded-full text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-ink"
        >
          <Icon name="arrow" size={18} />
        </Link>
      ) : null}
    </li>
  );
}

/** The alerts that need action as rows, for the bell's pop-up. */
export function ActionAlertRows({ todos }: { todos: Todo[] }) {
  return (
    <ul className="flex flex-col">
      {todos.map((todo) => (
        <ActionAlertItem key={todo.key} todo={todo} variant="row" />
      ))}
    </ul>
  );
}

/** "Needs your action" on Alerts: price changes, part deliveries, replies and credits, most urgent first. */
export function ActionAlerts({ todos }: { todos: Todo[] }) {
  return (
    <section aria-labelledby="needs-action-title" className="flex flex-col gap-2.5">
      <h2 id="needs-action-title">Needs your action</h2>
      {todos.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {todos.map((todo) => (
            <ActionAlertItem key={todo.key} todo={todo} variant="card" />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-[.9rem] text-muted">
          Nothing needs your action. You are all caught up.
        </p>
      )}
    </section>
  );
}
