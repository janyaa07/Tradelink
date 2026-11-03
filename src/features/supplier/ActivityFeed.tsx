import { cx } from "@/ui/cx";
import { Icon, type IconName } from "@/ui/Icon";
import { Pill } from "@/ui/Pill";
import { activityKind, activityTone, timeOfDay, type ActivityDay, type ActivityKind, type ActivityTone } from "./activity";
import type { ActivityView } from "./queries";

const ICONS: Record<ActivityKind, IconName> = { order: "order", stock: "box", account: "gear" };

const TONES: Record<ActivityTone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  plain: "bg-sunken text-muted",
};

/** One audit entry: what happened, who did it and when, with "Blocked" on denied attempts (SUP-17). */
function ActivityEvent({ item }: { item: ActivityView }) {
  return (
    <li className="flex items-start gap-3 border-t border-line/70 px-4 py-2.5 first:border-t-0">
      <span aria-hidden="true" className={cx("mt-0.5 grid size-7 flex-none place-items-center rounded-full", TONES[activityTone(item)])}>
        <Icon name={item.denied ? "shield" : ICONS[activityKind(item.action)]} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[.875rem] font-semibold">
          {item.action} {item.denied ? <Pill tone="bad">Blocked</Pill> : null}
        </p>
        <p className="break-words text-[.78rem] text-muted">{item.who}</p>
      </div>
      <time dateTime={item.at} className="num mt-0.5 flex-none text-[.78rem] text-muted">
        {timeOfDay(item.at)}
      </time>
    </li>
  );
}

/** Activity grouped by day, one card per day, newest first. */
export function ActivityFeed({ days }: { days: ActivityDay<ActivityView>[] }) {
  return (
    <>
      {days.map((day) => (
        <section key={day.key} aria-labelledby={`day-${day.key}`} className="rounded-xl border border-line bg-surface shadow-card">
          <h2 id={`day-${day.key}`} className="px-4 pt-3 pb-1.5">
            {day.label}
          </h2>
          <ul>
            {day.items.map((item) => (
              <ActivityEvent key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
