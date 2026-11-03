import type { ComponentPropsWithoutRef } from "react";
import { cx } from "./cx";

export type ButtonVariant = "default" | "primary" | "danger";
export type ButtonSize = "default" | "big";

const VARIANTS: Record<ButtonVariant, string> = {
  default: "border-line bg-surface text-ink hover:bg-sunken",
  primary: "border-accent bg-accent text-on-accent min-h-11 rail:min-h-0 hover:opacity-90",
  danger: "border-line bg-surface text-bad hover:bg-bad-soft",
};

const SIZES: Record<ButtonSize, string> = {
  default: "px-3.5 py-[7px]",
  big: "w-full min-h-11 px-3.5 py-[11px]",
};

export function buttonClass(variant: ButtonVariant = "default", size: ButtonSize = "default"): string {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-md border text-center text-[.9rem] font-semibold no-underline",
    "transition-[background-color,border-color,opacity] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line",
    VARIANTS[variant],
    SIZES[size],
    variant === "primary" && "disabled:hover:border-accent",
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "default", size = "default", type = "button", className, ...rest }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...rest} />;
}
