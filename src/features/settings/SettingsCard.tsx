import type { ReactNode } from "react";

/** One settings section: a card with a title row, then labelled rows divided by lines. */

type SettingsCardProps = {
  /** The anchor the side menu links to. */
  id: string;
  title: string;
  description?: ReactNode;
  /** A button at the end of the title row, such as Edit. */
  action?: ReactNode;
  children: ReactNode;
};

export function SettingsCard({ id, title, description, action, children }: SettingsCardProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="@container scroll-mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 rail:px-[18px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`${id}-title`}>{title}</h2>
          {description ? <p className="text-[.8rem] text-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

type SettingRowProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Ties the label to its control, for a text field. */
  htmlFor?: string;
  children: ReactNode;
};

/** A labelled row in a settings card: the label and hint on the left, the control on the right when there is room. */
export function SettingRow({ label, hint, htmlFor, children }: SettingRowProps) {
  const Label = htmlFor ? "label" : "div";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3.5 @min-[560px]:grid-cols-[200px_minmax(0,1fr)] rail:px-[18px]">
      <Label htmlFor={htmlFor} className="flex flex-col text-[.84rem] font-semibold">
        {label}
        {hint ? <span className="mt-0.5 text-[.75rem] font-normal text-muted">{hint}</span> : null}
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Read-only rows, such as an account's name and email. */
export function SettingFacts({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 border-t border-line px-4 py-2.5 text-[.84rem] @min-[560px]:grid-cols-[200px_minmax(0,1fr)] rail:px-[18px]"
        >
          <dt className="text-muted">{label}</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
