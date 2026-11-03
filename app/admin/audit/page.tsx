import type { Metadata } from "next";
import Form from "next/form";
import { requireRole } from "@/data/session";
import { FilterSelect, PhoneList, PhoneRow } from "@/features/admin/components/Rows";
import { AUDIT_PAGE_SIZE, auditHref, parseAuditQuery, type SearchParams } from "@/features/admin/params";
import { getAuditPage, type AuditEntry } from "@/features/admin/queries/audit";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Button } from "@/ui/Button";
import { Cell, DataTable, Row } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { PageHeader } from "@/ui/PageHeader";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Audit log" };

const COLUMNS = [
  { label: "When", className: "w-32" },
  { label: "Action" },
  { label: "Who" },
  { label: "Organisation" },
  { label: "Outcome", className: "w-28" },
];

function OutcomePill({ outcome }: { outcome: AuditEntry["outcome"] }) {
  return outcome === "denied" ? <Pill tone="bad">Blocked</Pill> : <Pill tone="good">Allowed</Pill>;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const query = parseAuditQuery(await searchParams);
  const [{ entries, total }, organisations] = await Promise.all([getAuditPage(query), getOrganisations()]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const filtered = query.orgId !== null || query.outcome !== "all";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit log"
        description="Every change on the platform, who made it and when, including blocked attempts. Entries cannot be edited."
      />
      <Form action="/admin/audit" className="flex flex-wrap items-center gap-2" aria-label="Filter the audit log">
        <FilterSelect label="Organisation" name="org" defaultValue={query.orgId ?? ""}>
          <option value="">All organisations</option>
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Outcome" name="outcome" defaultValue={query.outcome}>
          <option value="all">All outcomes</option>
          <option value="allowed">Allowed</option>
          <option value="denied">Blocked</option>
        </FilterSelect>
        <Button type="submit" size="small">
          Show entries
        </Button>
        {filtered ? (
          <LinkButton href="/admin/audit" variant="text" className="px-1">
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
        <DataTable
          label="Audit entries"
          columns={COLUMNS}
          phone={
            <PhoneList label="Audit entries">
              {entries.map((entry) => (
                <PhoneRow
                  key={entry.id}
                  title={entry.action}
                  sub={`${entry.who}, ${entry.orgName} · ${entry.role} · ${formatDateTime(entry.at)}`}
                  end={<OutcomePill outcome={entry.outcome} />}
                />
              ))}
            </PhoneList>
          }
        >
          {entries.map((entry) => (
            <Row key={entry.id}>
              <Cell num muted>
                {formatDateTime(entry.at)}
              </Cell>
              <Cell strong className="break-words">
                {entry.action}
              </Cell>
              <Cell>
                <span className="block">{entry.who}</span>
                <span className="block text-[.78rem] text-muted">{entry.role}</span>
              </Cell>
              <Cell>
                <span className="flex min-w-0 items-center gap-2">
                  <BusinessLogo name={entry.orgName} size={22} />
                  <span className="truncate">{entry.orgName}</span>
                </span>
              </Cell>
              <Cell>
                <OutcomePill outcome={entry.outcome} />
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      {total > AUDIT_PAGE_SIZE ? (
        <nav aria-label="Audit log pages" className="flex flex-wrap items-center justify-between gap-2">
          {query.page > 1 ? (
            <LinkButton href={auditHref({ ...query, page: query.page - 1 })} size="small">
              Show newer entries
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="num text-[.84rem] text-muted">
            Page {query.page} of {pages}
          </span>
          {query.page < pages ? (
            <LinkButton href={auditHref({ ...query, page: query.page + 1 })} size="small">
              Show older entries
            </LinkButton>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
