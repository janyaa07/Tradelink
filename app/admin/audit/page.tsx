import type { Metadata } from "next";
import Form from "next/form";
import { requireRole } from "@/data/session";
import { PageHead } from "@/features/admin/components/Layout";
import { AUDIT_PAGE_SIZE, auditHref, parseAuditQuery, type SearchParams } from "@/features/admin/params";
import { getAuditPage } from "@/features/admin/queries/audit";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { SelectField } from "@/ui/Field";
import { formatDateTime } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { Pill } from "@/ui/Pill";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const query = parseAuditQuery(await searchParams);
  const [{ entries, total }, organisations] = await Promise.all([getAuditPage(query), getOrganisations()]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const filtered = query.orgId !== null || query.outcome !== "all";

  return (
    <>
      <PageHead title="Audit log" sub="Who did what and when, including blocked attempts." />
      <Form action="/admin/audit" className="flex flex-wrap items-end gap-2.5" aria-label="Filter the audit log">
        <div className="w-full min-[480px]:w-60">
          <SelectField label="Organisation" name="org" defaultValue={query.orgId ?? ""}>
            <option value="">All organisations</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="w-full min-[480px]:w-44">
          <SelectField label="Outcome" name="outcome" defaultValue={query.outcome}>
            <option value="all">All outcomes</option>
            <option value="allowed">Allowed</option>
            <option value="denied">Blocked</option>
          </SelectField>
        </div>
        <Button type="submit">Show entries</Button>
        {filtered ? (
          <LinkButton href="/admin/audit" variant="text" className="min-h-10">
            Clear filters
          </LinkButton>
        ) : null}
      </Form>

      {entries.length === 0 ? (
        <EmptyState
          action={
            query.page > 1 ? (
              <LinkButton href={auditHref({ ...query, page: 1 })} variant="text">
                Go to the first page
              </LinkButton>
            ) : undefined
          }
        >
          {query.page > 1 ? "No entries on this page." : filtered ? "No entries match these filters." : "No activity yet."}
        </EmptyState>
      ) : (
        <RecordList>
          {entries.map((entry) => (
            <RecordCard
              key={entry.id}
              lead={<BusinessLogo name={entry.orgName} size={36} />}
              title={entry.action}
              sub={`${entry.who}, ${entry.orgName} · ${entry.role} · ${formatDateTime(entry.at)}`}
              pill={entry.outcome === "denied" ? <Pill tone="bad">Blocked</Pill> : <Pill tone="good">Allowed</Pill>}
            />
          ))}
        </RecordList>
      )}

      {total > AUDIT_PAGE_SIZE ? (
        <nav aria-label="Audit log pages" className="flex flex-wrap items-center justify-between gap-2">
          {query.page > 1 ? (
            <LinkButton href={auditHref({ ...query, page: query.page - 1 })}>Newer entries</LinkButton>
          ) : (
            <span />
          )}
          <span className="text-[.84rem] text-muted">
            Page {query.page} of {pages}
          </span>
          {query.page < pages ? (
            <LinkButton href={auditHref({ ...query, page: query.page + 1 })}>Older entries</LinkButton>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
