import type { ComponentPropsWithoutRef } from "react";

type SwitchProps = Omit<ComponentPropsWithoutRef<"input">, "type" | "role" | "className" | "title"> & {
  title: string;
  /** One line that says what the setting changes. */
  description: string;
};

/** A labelled checkbox switch that takes effect immediately. */
export function Switch({ title, description, ...input }: SwitchProps) {
  return (
    <label className="flex items-center justify-between gap-3.5 border-b border-line py-2 last:border-b-0">
      <span className="min-w-0">
        <b className="block font-bold">{title}</b>
        <span className="block text-[.84rem] text-muted">{description}</span>
      </span>
      <span className="relative inline-flex h-[26px] w-11 flex-none">
        <input
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed"
          {...input}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none size-full rounded-full bg-control-line p-[2px] transition-colors duration-150 peer-checked:bg-accent peer-disabled:opacity-50 peer-checked:[&>span]:translate-x-[18px]"
        >
          <span className="block size-[22px] rounded-full bg-surface shadow-card transition-transform duration-150" />
        </span>
      </span>
    </label>
  );
}
