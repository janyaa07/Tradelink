import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./Button";
import { cx } from "./cx";

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  /** "text" renders the inline accent text link used for "See all" and "Back". */
  variant?: ButtonVariant | "text";
  size?: ButtonSize;
};

export const textLinkClass =
  "inline-flex min-h-6 items-center gap-1 font-semibold text-accent no-underline hover:underline underline-offset-2";

export function LinkButton({ variant = "default", size = "default", className, ...rest }: LinkButtonProps) {
  const base = variant === "text" ? textLinkClass : buttonClass(variant, size);
  return <Link className={cx(base, className)} {...rest} />;
}
