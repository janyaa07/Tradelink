"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { formatDate, formatDateTime } from "@/ui/format";
import { Pill, type PillTone } from "@/ui/Pill";
import { useToast } from "@/ui/Toast";
import { answerDeliveryDateAction, proposeDeliveryDateAction, sendOrderMessageAction } from "./request-actions";
import type { OrderRequest } from "./requests";

type Props = {
  orderId: string;
  myOrgId: string;
  otherName: string;
  requests: OrderRequest[];
  /** The first delivery's date while it can still move (pending or accepted); otherwise null. */
  firstDate: string | null;
  /** The rest's date while it is waiting; otherwise null. */
  restDate: string | null;
  /** The earliest date a new delivery date can have, as YYYY-MM-DD. */
  today: string;
};

const STATUS: Record<OrderRequest["status"], { label: string; tone: PillTone }> = {
  open: { label: "Waiting for an answer", tone: "warn" },
  accepted: { label: "Agreed", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  withdrawn: { label: "Replaced", tone: "plain" },
  sent: { label: "Sent", tone: "plain" },
};

const fieldClass = "min-h-9 rounded-lg border border-line bg-surface px-2.5 text-[.875rem] text-ink";

function what(request: OrderRequest): string {
  return request.part === "rest" ? "the rest" : "this order";
}

/** Messages and delivery date changes between the buyer and the supplier on one order. */
export function OrderConversation({ orderId, myOrgId, otherName, requests, firstDate, restDate, today }: Props) {
  const router = useRouter();
  const { show } = useToast();
  const id = useId();
  const [busy, start] = useTransition();
  const [message, setMessage] = useState("");
  const [moving, setMoving] = useState(false);
  const [part, setPart] = useState<"first" | "rest">(firstDate ? "first" : "rest");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [keys, setKeys] = useState(() => ({ message: crypto.randomUUID(), move: crypto.randomUUID() }));
  const canMove = firstDate !== null || restDate !== null;
  const toAnswer = requests.filter((request) => request.kind === "date_change" && request.status === "open" && request.fromOrgId !== myOrgId);

  const run = <T,>(call: () => Promise<ActionResult<T>>, after: () => void) =>
    start(async () => {
      const result = await call();
      show(result.ok ? (result.message ?? "Done.") : result.error);
      if (result.ok) {
        after();
        router.refresh();
      }
    });

  const send = () =>
    run(
      () => sendOrderMessageAction({ orderId, body: message, key: keys.message }),
      () => {
        setMessage("");
        setKeys((current) => ({ ...current, message: crypto.randomUUID() }));
      },
    );

  const propose = () =>
    run(
      () => proposeDeliveryDateAction({ orderId, part, date, note: note || undefined, key: keys.move }),
      () => {
        setMoving(false);
        setDate("");
        setNote("");
        setKeys((current) => ({ ...current, move: crypto.randomUUID() }));
      },
    );

  const answer = (request: OrderRequest, accept: boolean) =>
    run(
      () => answerDeliveryDateAction({ requestId: request.id, accept, key: crypto.randomUUID() }),
      () => undefined,
    );

  return (
    <section aria-labelledby={`${id}-title`} className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
        <h2 id={`${id}-title`}>Messages with {otherName}</h2>
        {canMove && !moving ? (
          <Button size="small" onClick={() => setMoving(true)}>
            Change delivery date
          </Button>
        ) : null}
      </div>

      {toAnswer.map((request) => (
        <div key={request.id} className="flex flex-col gap-2 border-t border-line bg-warn-soft/50 px-4 py-3">
          <p className="text-[.875rem]">
            <b className="font-semibold">{request.fromName}</b> asks to move {what(request)} to{" "}
            <b className="font-semibold">{formatDate(request.proposedDate ?? today)}</b>.
            {request.body ? <span className="text-ink/80"> &ldquo;{request.body}&rdquo;</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="small" disabled={busy} onClick={() => answer(request, true)}>
              Accept new date
            </Button>
            <Button size="small" disabled={busy} onClick={() => answer(request, false)}>
              Decline
            </Button>
          </div>
        </div>
      ))}

      {moving ? (
        <form
          className="flex flex-col gap-2.5 border-t border-line bg-sunken/50 px-4 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            propose();
          }}
        >
          <div className="flex flex-wrap items-end gap-2.5">
            {firstDate && restDate ? (
              <label className="flex flex-col gap-1 text-[.8rem] text-muted">
                Which delivery
                <select value={part} onChange={(event) => setPart(event.currentTarget.value === "rest" ? "rest" : "first")} className={fieldClass}>
                  <option value="first">First, now {formatDate(firstDate)}</option>
                  <option value="rest">The rest, now {formatDate(restDate)}</option>
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-[.8rem] text-muted">
              New date
              <input type="date" required min={today} value={date} onChange={(event) => setDate(event.currentTarget.value)} className={fieldClass} />
            </label>
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[.8rem] text-muted">
              Reason (optional)
              <input
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.currentTarget.value)}
                className={fieldClass}
                placeholder="Stock arrives Monday"
              />
            </label>
          </div>
          <p className="text-[.8rem] text-muted">{otherName} has to agree before the date changes.</p>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="small" disabled={busy || date === ""}>
              Ask {otherName}
            </Button>
            <Button size="small" disabled={busy} onClick={() => setMoving(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {requests.length > 0 ? (
        <ol aria-label="Messages and changes" className="divide-y divide-line border-t border-line">
          {requests.map((request) => {
            const mine = request.fromOrgId === myOrgId;
            return (
              <li key={request.id} className="flex flex-col gap-1 px-4 py-2.5 text-[.875rem]">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[.75rem] text-muted">
                  <b className="font-semibold text-ink">{mine ? "You" : request.fromName}</b>
                  <span>{formatDateTime(request.createdAt)}</span>
                  {request.kind === "date_change" ? <Pill tone={STATUS[request.status].tone}>{STATUS[request.status].label}</Pill> : null}
                </p>
                {request.kind === "message" ? (
                  <p className="break-words whitespace-pre-line">{request.body}</p>
                ) : (
                  <p>
                    Asked to move {what(request)} to <b className="font-semibold">{formatDate(request.proposedDate ?? today)}</b>
                    {request.body ? <span className="text-muted"> · {request.body}</span> : null}
                    {request.answer ? <span className="text-muted"> · Reply: {request.answer}</span> : null}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-line px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label htmlFor={`${id}-message`} className="sr-only">
          Message {otherName}
        </label>
        <textarea
          id={`${id}-message`}
          rows={1}
          value={message}
          maxLength={500}
          onChange={(event) => setMessage(event.currentTarget.value)}
          placeholder={`Message ${otherName}`}
          className="min-h-9 min-w-0 flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-1.5 text-[.875rem] text-ink placeholder:text-muted"
        />
        <Button type="submit" size="small" variant="primary" disabled={busy || message.trim() === ""}>
          Send message
        </Button>
      </form>
    </section>
  );
}
