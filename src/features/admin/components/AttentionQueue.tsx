import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { formatDateTime } from "@/ui/format";
import { Icon } from "@/ui/Icon";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";
import { markHandledAction, resolveDisputeAction } from "../actions";
import { attentionIcon, canMarkHandled, isDispute, priorityLabel, sourceOf, type AttentionItem, type Priority } from "../attention";
import { ActionForm } from "./ActionForm";
import { AssignSelect } from "./AssignSelect";

const ICON_TONE: Record<Priority, string> = {
  high: "bg-bad-soft text-bad",
  medium: "bg-warn-soft text-warn",
};

const MARKER_TONE: Record<Priority, string> = {
  high: "bg-bad",
  medium: "bg-warn",
};

export function AttentionIcon({ item, size }: { item: Pick<AttentionItem, "type" | "priority">; size: "big" | "small" }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid flex-none place-items-center",
        size === "big" ? "size-11 rounded-[13px]" : "size-[34px] rounded-[11px]",
        ICON_TONE[item.priority],
      )}
    >
      <Icon name={attentionIcon(item.type)} size={size === "big" ? 22 : 18} />
    </span>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  return <Pill tone={priority === "high" ? "bad" : "warn"}>{priorityLabel(priority)}</Pill>;
}

function DisputeActions({ issueId }: { issueId: string }) {
  return (
    <>
      <ActionForm action={resolveDisputeAction} fields={{ issue: issueId, outcome: "credit", key: crypto.randomUUID() }}>
        <Button type="submit" variant="primary" size="small">
          Credit buyer
        </Button>
      </ActionForm>
      <ActionForm action={resolveDisputeAction} fields={{ issue: issueId, outcome: "close", key: crypto.randomUUID() }}>
        <Button type="submit" size="small">
          Close, no credit
        </Button>
      </ActionForm>
    </>
  );
}

function ItemActions({ item }: { item: AttentionItem }) {
  if (isDispute(item)) return <DisputeActions issueId={sourceOf(item.key).id} />;
  const blocked = sourceOf(item.key).rule === "audit";
  return (
    <>
      {blocked ? (
        <LinkButton href="/admin/audit?outcome=denied" size="small">
          Open audit log
        </LinkButton>
      ) : null}
      {!blocked && item.orgId ? (
        <LinkButton href={`/admin/suppliers/${item.orgId}`} size="small">
          View supplier
        </LinkButton>
      ) : null}
      {canMarkHandled(item) ? (
        <ActionForm action={markHandledAction} fields={{ item: item.key }}>
          <Button type="submit" size="small">
            Mark handled
          </Button>
        </ActionForm>
      ) : null}
    </>
  );
}

type Operators = { userId: string; fullName: string }[];

/**
 * One Needs attention item (ADM-02) as a queue row: a priority marker, the type icon, title and
 * detail, the priority, Assigned to and the item's actions. On a phone the controls wrap under the text.
 */
function AttentionRow({ item, operators }: { item: AttentionItem; operators: Operators }) {
  return (
    <li className="relative grid grid-cols-[34px_minmax(0,1fr)] gap-x-3 gap-y-2.5 py-3 pr-4 pl-5 rail:grid-cols-[34px_minmax(0,1fr)_auto_10.5rem_auto] rail:items-center rail:gap-x-3.5">
      <span aria-hidden="true" className={cx("absolute top-3 bottom-3 left-0 w-1 rounded-r-[3px]", MARKER_TONE[item.priority])} />
      <AttentionIcon item={item} size="small" />
      <div className="min-w-0">
        <h2 className="break-words text-[.9rem] font-semibold">{item.title}</h2>
        <p className="break-words text-[.8rem] text-muted">
          <span className="text-ink/80">{item.type}</span>
          <span aria-hidden="true"> · </span>
          {item.detail}
        </p>
        <p className="num text-[.75rem] text-muted">Since {formatDateTime(item.createdAt)}</p>
      </div>
      <div className="col-start-2 flex flex-wrap items-start gap-2 rail:contents">
        <span className="self-center rail:justify-self-start">
          <PriorityPill priority={item.priority} />
        </span>
        <AssignSelect itemKey={item.key} assignedUserId={item.assignedUserId} operators={operators} />
        <div className="flex flex-wrap items-start gap-1.5 rail:justify-end">
          <ItemActions item={item} />
        </div>
      </div>
    </li>
  );
}

/** The attention queue in one card, most urgent first. */
export function AttentionQueue({ items, operators }: { items: AttentionItem[]; operators: Operators }) {
  return (
    <ul aria-label="Queue" className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((item) => (
        <AttentionRow key={item.key} item={item} operators={operators} />
      ))}
    </ul>
  );
}
