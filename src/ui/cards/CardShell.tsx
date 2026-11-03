import Link from "next/link";
import type { ReactNode } from "react";
import type { CardAction, CardEnvelope, CardState } from "@/cards/envelope";
import { Button, type ButtonVariant } from "@/ui/Button";
import { cx } from "@/ui/cx";
import { CardStateChip } from "./CardStateChip";
import { formatClock } from "./format";

const VARIANTS: Record<CardAction["style"], ButtonVariant> = { primary: "primary", secondary: "default", danger: "danger" };

type ActionBarProps = {
  actions: CardAction[];
  onAction: (id: string) => void;
  /** The action being sent; every button waits until it settles. */
  pending?: string | null;
  disabled?: boolean;
  /** A label for an action while it applies, such as a countdown on Undo. */
  labels?: Partial<Record<string, string>>;
};

/** The card's buttons, named by the server, each enabled only where its function would accept it. */
export function CardActionBar({ actions, onAction, pending = null, disabled = false, labels = {} }: ActionBarProps) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant={VARIANTS[action.style]}
          className={action.style === "primary" ? "flex-1" : undefined}
          disabled={disabled || !action.enabled || pending !== null}
          aria-busy={pending === action.id || undefined}
          onClick={() => onAction(action.id)}
        >
          {pending === action.id ? "Sending…" : (labels[action.id] ?? action.label)}
        </Button>
      ))}
    </div>
  );
}

type CardShellProps = {
  card: CardEnvelope;
  title: string;
  /** The shop or supplier, order or PO the card is about. */
  subjectLabel?: string;
  /** Shown instead of the stored state while a tap is applying. */
  state?: CardState;
  stateLabel?: string;
  children: ReactNode;
  /** The action bar, or the editing controls while fields are open. */
  footerActions?: ReactNode;
};

/** Header, status chip, why line, body, action bar and footer, shared by every card (section 4.2). */
export function CardShell({ card, title, subjectLabel, state, stateLabel, children, footerActions }: CardShellProps) {
  const superseded = card.state === "superseded" || card.supersededBy !== null;
  return (
    <article
      id={`card-${card.id}`}
      aria-label={title}
      className={cx(
        "flex w-full min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-card",
        superseded && "opacity-70",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2>{title}</h2>
          {subjectLabel ? <span className="text-[.82rem] text-muted [overflow-wrap:anywhere]">{subjectLabel}</span> : null}
        </div>
        <CardStateChip state={superseded ? "superseded" : (state ?? card.state)} label={superseded ? undefined : stateLabel} />
      </header>

      {superseded ? (
        <p className="rounded-md bg-sunken px-3 py-2 text-[.88rem] text-muted">
          Updated,{" "}
          {card.supersededBy ? (
            <a href={`#card-${card.supersededBy}`} className="font-semibold text-accent underline-offset-2 hover:underline">
              see latest
            </a>
          ) : (
            "see latest"
          )}
        </p>
      ) : null}

      {card.reason ? (
        <p className="text-[.88rem] text-muted">
          {card.reason.text}
          {card.reason.detailsHref ? (
            <>
              {" "}
              <Link href={card.reason.detailsHref} className="font-semibold text-accent underline-offset-2 hover:underline">
                Details
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-3">{children}</div>

      {footerActions ? (
        <fieldset disabled={superseded} className="m-0 min-w-0 border-0 p-0">
          {footerActions}
        </fieldset>
      ) : null}

      <footer className="text-[.75rem] text-muted tabular-nums">
        Updated {formatClock(card.updatedAt)} · v{card.subject.version}
      </footer>
    </article>
  );
}
