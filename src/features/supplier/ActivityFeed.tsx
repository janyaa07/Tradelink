import { formatDateTime } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import type { ActivityView } from "./queries";

/** Audit entries with who and when, and "Blocked" on denied attempts (SUP-17). */
export function ActivityFeed({ items }: { items: ActivityView[] }) {
  if (items.length === 0) return <p className="text-muted">No activity yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="break-words">
              {item.action} {item.denied ? <Pill tone="bad">Blocked</Pill> : null}
            </p>
            <p className="break-words text-[.84rem] text-muted">{item.who}</p>
          </div>
          <time dateTime={item.at} className="whitespace-nowrap text-[.84rem] text-muted">
            {formatDateTime(item.at)}
          </time>
        </li>
      ))}
    </ul>
  );
}
