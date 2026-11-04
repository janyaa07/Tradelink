import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/ui/cx";

/**
 * The home page's building blocks (one focus at a time): a greeting with the briefing line, the
 * AI ask bar, quiet rows for the other steps and plain bars that compare a number with a usual one.
 */

type GreetingProps = {
  /** "Tuesday, 3 November · Lotus Leaf Vegetarian". */
  eyebrow: string;
  title: string;
  /** The line under the greeting: what needs the person, worked out from the data. */
  line: string;
  /** Tradelink AI's greeting wears the gradient; roles without the AI keep plain text. */
  ai?: boolean;
  /** Beside the greeting on laptop, such as the cut-off countdown. */
  aside?: ReactNode;
  children?: ReactNode;
};

export function HomeGreeting({ eyebrow, title, line, ai = true, aside, children }: GreetingProps) {
  return (
    <section aria-label="Greeting" className="relative flex flex-col gap-4">
      {ai ? <div aria-hidden="true" className="ai-glow pointer-events-none absolute inset-x-0 -top-8 h-52" /> : null}
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <p className="text-[.78rem] font-medium text-muted">{eyebrow}</p>
          <h1 className={cx("text-[1.6rem] leading-[1.2] tracking-[-0.025em] rail:text-[1.85rem]", ai && "ai-text")}>{title}</h1>
          <p className="max-w-[680px] text-[.95rem] leading-relaxed text-ink/80">{line}</p>
        </div>
        {aside}
      </div>
      {children ? <div className="relative flex flex-col gap-2.5">{children}</div> : null}
    </section>
  );
}

type AskBarProps = {
  /** The role's Tradelink AI page; the question opens a chat there. */
  action: string;
  placeholder: string;
  suggestions: string[];
  /** When Home was shown; sent with the question so a reload of the chat does not ask twice. */
  stamp: string;
};

/** Ask Tradelink AI from Home: the question opens the chat and is sent at once. */
export function AskBar({ action, placeholder, suggestions, stamp }: AskBarProps) {
  return (
    <>
      <form action={action} method="get" className="ai-ring flex h-12 items-center gap-2.5 rounded-xl pr-1.5 pl-4">
        <span aria-hidden="true" className="ai-spark size-[18px]" />
        <input type="hidden" name="t" value={stamp} />
        <label htmlFor="home-ask" className="sr-only">
          Ask Tradelink AI
        </label>
        <input
          id="home-ask"
          name="q"
          required
          maxLength={2000}
          autoComplete="off"
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-[.9rem] text-ink outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Ask Tradelink AI" className="ai-fill grid size-9 flex-none place-items-center rounded-lg">
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
      <div role="group" aria-label="Suggested questions" className="flex flex-wrap gap-1.5">
        {suggestions.map((text) => (
          <Link
            key={text}
            href={`${action}?q=${encodeURIComponent(text)}&t=${stamp}`}
            className="inline-flex min-h-7 items-center rounded-full border border-line bg-surface px-2.5 text-[.78rem] font-medium text-ink no-underline transition-colors duration-150 hover:border-[var(--ai-2)] hover:text-accent"
          >
            {text}
          </Link>
        ))}
      </div>
    </>
  );
}

export type StepTone = "bad" | "warn" | "info" | "good";

const DOTS: Record<StepTone, string> = { bad: "bg-bad", warn: "bg-[#C98A1A]", info: "bg-info", good: "bg-good" };

/** A row inside an At a glance tab. */
export function GlanceRow({
  lead,
  title,
  detail,
  end,
  href,
}: {
  lead?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1 text-[.85rem]">
        <b className="font-semibold">{title}</b>
        {detail ? <span className="text-muted"> · {detail}</span> : null}
      </span>
      {end}
    </>
  );
  const className = "flex items-center gap-2.5 border-t border-line px-1 py-2.5 text-ink no-underline first:border-t-0";
  return href ? (
    <Link href={href} className={cx(className, "hover:bg-sunken/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A level bar, such as days of stock left. */
export function LevelBar({ percent, tone }: { percent: number; tone: StepTone | "plain" }) {
  const fill = tone === "plain" ? "bg-[#7C9A8C]" : DOTS[tone];
  return (
    <span aria-hidden="true" className="block h-1.5 w-full overflow-hidden rounded-full bg-sunken">
      <span className={cx("block h-full rounded-full", fill)} style={{ width: `${Math.max(2, Math.min(100, percent))}%` }} />
    </span>
  );
}

/** A value against a usual mark: the bar is today, the thin line is a usual day. */
export function CompareBar({
  percent,
  usualPercent,
  tone,
  label,
}: {
  percent: number;
  usualPercent: number | null;
  tone: StepTone | "accent";
  label: string;
}) {
  return (
    <span role="img" aria-label={label} className="relative block h-3 rounded-full bg-sunken">
      <span
        className={cx("absolute inset-y-0 left-0 rounded-full", tone === "accent" ? "bg-accent" : DOTS[tone])}
        style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
      />
      {usualPercent !== null ? <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${Math.min(99, usualPercent)}%` }} /> : null}
    </span>
  );
}

/** The countdown to today's order cut-off, as a ring. */
export function CutoffRing({ minutesLeft, cutoff, totalMinutes }: { minutesLeft: number | null; cutoff: string; totalMinutes: number }) {
  const circumference = 2 * Math.PI * 23;
  const share = minutesLeft === null ? 0 : Math.min(1, minutesLeft / totalMinutes);
  const hours = minutesLeft === null ? null : Math.floor(minutesLeft / 60);
  const text = minutesLeft === null ? "Cut-off passed" : hours ? `${hours}h ${minutesLeft % 60}m` : `${minutesLeft}m`;
  return (
    <div
      role="img"
      aria-label={minutesLeft === null ? `Today's ${cutoff} cut-off has passed` : `${text} until the ${cutoff} cut-off`}
      className="relative flex items-center gap-3 rounded-lg border border-line bg-surface py-2.5 pr-4 pl-3 shadow-card"
    >
      <svg viewBox="0 0 56 56" className="size-10 flex-none" aria-hidden="true">
        <circle cx="28" cy="28" r="23" fill="none" stroke="var(--sunken)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r="23"
          fill="none"
          stroke={share > 0.25 ? "var(--accent)" : "#C98A1A"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          transform="rotate(-90 28 28)"
        />
      </svg>
      <div>
        <p className="text-[1.1rem] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{text}</p>
        <p className="text-[.75rem] text-muted">{minutesLeft === null ? `New orders go to the next run` : `until the ${cutoff} cut-off`}</p>
      </div>
    </div>
  );
}
