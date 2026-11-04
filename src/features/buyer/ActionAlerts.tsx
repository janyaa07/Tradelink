import Link from "next/link";
import type { Todo, TodoAction, TodoTone } from "@/domain/todos";
import { cx } from "@/ui/cx";
import { Icon, type IconName } from "@/ui/Icon";
import { TodoActions } from "./TodoActions";

const KINDS: Record<TodoAction["kind"], { label: string; icon: IconName }> = {
  price: { label: "Price change", icon: "trend" },
  partial: { label: "Part delivery", icon: "truck" },
  reply: { label: "Reply", icon: "chat" },
  credit: { label: "Credit", icon: "receipt" },
  date: { label: "Date change", icon: "truck" },
};

const ICON_TONES: Record<TodoTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

/**
 * One alert: what happened, in words, the buttons that settle it and, when it is about an order,
 * an arrow to that order. The buttons sit on the right when the list is wide, under the words in the bell's pop-up.
 */
function ActionAlertItem({ todo }: { todo: Todo }) {
  const kind = KINDS[todo.action.kind];
  return (
    <li className="flex min-w-0 items-start gap-3 border-t border-line px-4 py-3.5 first:border-t-0">
      <span className={cx("grid size-8 flex-none place-items-center rounded-[9px]", ICON_TONES[todo.tone])}>
        <Icon name={kind.icon} size={16} />
        <span className="sr-only">{kind.label}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[.875rem] font-semibold">{todo.title}</p>
          <p className="text-[.8rem] text-muted">{todo.detail}</p>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-1.5">
          <TodoActions action={todo.action} />
          {todo.orderId ? (
            <Link
              href={`/buyer/orders/${todo.orderId}`}
              aria-label={`Open the order: ${todo.title}`}
              title="Open the order"
              className="grid size-8 flex-none place-items-center rounded-md text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-ink"
            >
              <Icon name="arrow" size={16} />
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** The alerts that need action as rows, for the bell's pop-up. */
export function ActionAlertRows({ todos }: { todos: Todo[] }) {
  return (
    <ul className="@container flex flex-col">
      {todos.map((todo) => (
        <ActionAlertItem key={todo.key} todo={todo} />
      ))}
    </ul>
  );
}

/** "Needs your action" on Alerts, in one card: price changes, part deliveries, replies and credits, most urgent first. */
export function ActionAlerts({ todos }: { todos: Todo[] }) {
  return (
    <section aria-labelledby="needs-action-title" className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="needs-action-title">Needs your action</h2>
        {todos.length > 0 ? <span className="num text-[.8rem] text-muted">{todos.length}</span> : null}
      </div>
      {todos.length > 0 ? (
        <ActionAlertRows todos={todos} />
      ) : (
        <p className="px-4 py-4 text-[.875rem] text-muted">Nothing needs your action. You are all caught up.</p>
      )}
    </section>
  );
}
