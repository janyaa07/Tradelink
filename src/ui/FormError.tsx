import type { ReactNode } from "react";

type FormErrorProps = {
  id?: string;
  /** Says what to fix, such as "Enter a price above 0." Renders nothing when empty. */
  children?: ReactNode;
};

export function FormError({ id, children }: FormErrorProps) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-[.84rem] font-semibold text-bad">
      {children}
    </p>
  );
}
