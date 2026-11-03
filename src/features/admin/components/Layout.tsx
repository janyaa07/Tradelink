import type { ReactNode } from "react";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";
import { ORG_STATUS, type OrgStatus } from "../labels";

/** Page title and the one-line description under it. */
export function PageHead({ title, sub, action }: { title: ReactNode; sub: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 flex-col gap-[3px]">
        <h1>{title}</h1>
        <p className="text-muted">{sub}</p>
      </div>
      {action}
    </div>
  );
}

export function SectionHead({ children }: { children: ReactNode }) {
  return <h2 className="mt-1">{children}</h2>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <LinkButton href={href} variant="text" className="self-start font-medium">
      {children}
    </LinkButton>
  );
}

export function OrgStatusPill({ status }: { status: OrgStatus }) {
  return <Pill tone={ORG_STATUS[status].tone}>{ORG_STATUS[status].label}</Pill>;
}

/** The prototype's profile list: small uppercase labels over values, as many columns as fit. */
export function ProfileList({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-x-4 gap-y-2.5">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[.72rem] uppercase tracking-[.04em] text-muted">{label}</dt>
          <dd className="break-words [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A divided row inside a home panel (prototype .mini). */
export function MiniRow({ lead, title, sub, end }: { lead?: ReactNode; title: ReactNode; sub: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 border-b border-line py-2 last:border-b-0">
      {lead}
      <span className="min-w-0 flex-1 text-[.9rem]">
        {title}
        <small className="block text-[.8rem] text-muted">{sub}</small>
      </span>
      {end}
    </div>
  );
}

/** Two panels side by side from 860px (prototype .cols). */
export function Columns({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-start gap-3.5 min-[860px]:grid-cols-2">{children}</div>;
}
