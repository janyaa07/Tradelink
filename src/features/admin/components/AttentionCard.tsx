import { Button } from "@/ui/Button";
import { cx } from "@/ui/cx";
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
        <Button type="submit" variant="primary">
          Credit buyer
        </Button>
      </ActionForm>
      <ActionForm action={resolveDisputeAction} fields={{ issue: issueId, outcome: "close", key: crypto.randomUUID() }}>
        <Button type="submit">Close, no credit</Button>
      </ActionForm>
    </>
  );
}

function ItemActions({ item }: { item: AttentionItem }) {
  if (isDispute(item)) return <DisputeActions issueId={sourceOf(item.key).id} />;
  const blocked = sourceOf(item.key).rule === "audit";
  return (
    <>
      {blocked ? <LinkButton href="/admin/audit?outcome=denied">Audit log</LinkButton> : null}
      {!blocked && item.orgId ? <LinkButton href={`/admin/suppliers/${item.orgId}`}>View supplier</LinkButton> : null}
      {canMarkHandled(item) ? (
        <ActionForm action={markHandledAction} fields={{ item: item.key }}>
          <Button type="submit">Mark handled</Button>
        </ActionForm>
      ) : null}
    </>
  );
}

type Props = {
  item: AttentionItem;
  operators: { userId: string; fullName: string }[];
};

/** One Needs attention item (ADM-02): type icon, type, priority, title, detail, actions and Assigned to. */
export function AttentionCard({ item, operators }: Props) {
  return (
    <article
      className={cx(
        "flex min-w-0 flex-col gap-[9px] rounded-lg border bg-surface px-3.5 py-3 shadow-card",
        item.priority === "high" ? "border-bad" : "border-line",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <AttentionIcon item={item} size="big" />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[.84rem] text-muted">{item.type}</span>
            <PriorityPill priority={item.priority} />
          </div>
          <h2 className="break-words">{item.title}</h2>
          <p className="break-words text-[.84rem] text-muted">{item.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-line pt-2.5">
        <div className="flex flex-wrap items-start gap-1.5">
          <ItemActions item={item} />
        </div>
        <AssignSelect itemKey={item.key} assignedUserId={item.assignedUserId} operators={operators} />
      </div>
    </article>
  );
}
