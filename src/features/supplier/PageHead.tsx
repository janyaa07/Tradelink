import type { ReactNode } from "react";

/** Page title and the one-line description under it. */
export function PageHead({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <h1>{title}</h1>
      <p className="text-muted">{children}</p>
    </div>
  );
}
