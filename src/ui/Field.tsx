import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cx } from "./cx";

export const controlClass = cx(
  "w-full min-w-0 min-h-10 rounded-md border border-control-line bg-surface px-2.5 py-2 text-[.92rem] text-ink",
  "placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:border-bad",
);

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-[3px] text-[.82rem] text-muted">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p id={`${id}-hint`}>{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="font-semibold text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Described = { label: string; hint?: string; error?: string };

function describedBy(id: string, hint?: string, error?: string): string | undefined {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function useFieldId(id: string | undefined): string {
  const generated = useId();
  return id ?? generated;
}

type TextFieldProps = Described & Omit<ComponentPropsWithoutRef<"input">, "className">;

export function TextField({ label, hint, error, id, ...input }: TextFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <input
        id={fieldId}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...input}
      />
    </FieldShell>
  );
}

type SelectFieldProps = Described & Omit<ComponentPropsWithoutRef<"select">, "className">;

export function SelectField({ label, hint, error, id, children, ...select }: SelectFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <select
        id={fieldId}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type TextAreaFieldProps = Described & Omit<ComponentPropsWithoutRef<"textarea">, "className"> & {
  /** Monospace on a sunken ground, for the order message box. */
  mono?: boolean;
};

export function TextAreaField({ label, hint, error, id, mono = false, ...textarea }: TextAreaFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error}>
      <textarea
        id={fieldId}
        className={cx(controlClass, "min-h-[150px] resize-y", mono && "bg-sunken p-2.5 font-mono leading-normal")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...textarea}
      />
    </FieldShell>
  );
}

/** Lays fields out in as many 150px+ columns as fit. */
export function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">{children}</div>;
}
