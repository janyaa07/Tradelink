import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { assignedCounts } from "@/features/admin/attention";
import { NameCell, PhoneList, PhoneRow } from "@/features/admin/components/Rows";
import { listHref, param, type SearchParams } from "@/features/admin/params";
import { presenceOf, PRESENCE_TONE } from "@/features/admin/presence";
import { getAttentionItems } from "@/features/admin/queries/attention";
import { getOperators } from "@/features/admin/queries/people";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Cell, DataTable, Row } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";
import { Pill } from "@/ui/Pill";

export const metadata: Metadata = { title: "Operators" };

const PRESENCE_FILTERS = ["all", "Online", "Away", "Offline"] as const;
type PresenceFilter = (typeof PRESENCE_FILTERS)[number];

const COLUMNS = [
  { label: "Operator" },
  { label: "Team" },
  { label: "Shift" },
  { label: "Assigned items", align: "right" as const, className: "w-32" },
  { label: "Status", className: "w-28" },
];

function parsePresence(value: string | undefined): PresenceFilter {
  return PRESENCE_FILTERS.find((filter) => filter !== "all" && filter.toLowerCase() === value) ?? "all";
}

export default async function OperatorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const filter = parsePresence(param(await searchParams, "presence"));
  const [operators, items] = await Promise.all([getOperators(), getAttentionItems()]);
  const assigned = assignedCounts(items);
  const now = new Date();
  const rows = operators.map((operator) => ({ operator, presence: presenceOf(operator.lastSeenAt, now) }));
  const shown = filter === "all" ? rows : rows.filter((row) => row.presence === filter);
  const count = (tab: PresenceFilter) => (tab === "all" ? rows.length : rows.filter((row) => row.presence === tab).length);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Operators" description="The Tradelink team who handle approvals, orders and support." />
      <FilterTabs
        label="Filter operators"
        tabs={PRESENCE_FILTERS.map((tab) => ({
          href: listHref("/admin/operators", { presence: tab === "all" ? null : tab.toLowerCase() }),
          label: tab === "all" ? "All" : tab,
          count: count(tab),
          current: tab === filter,
        }))}
      />
      {shown.length === 0 ? (
        <EmptyState>{filter === "all" ? "No operators yet." : `No operators are ${filter.toLowerCase()} right now.`}</EmptyState>
      ) : (
        <DataTable
          label="Operators"
          columns={COLUMNS}
          phone={
            <PhoneList label="Operators">
              {shown.map(({ operator, presence }) => (
                <PhoneRow
                  key={operator.userId}
                  lead={<BusinessLogo name={operator.fullName} seedKey={operator.userId} size={36} />}
                  title={operator.fullName}
                  sub={
                    <>
                      {operator.team} · {assigned.get(operator.userId) ?? 0} assigned
                      <br />
                      {operator.shift}
                    </>
                  }
                  end={<Pill tone={PRESENCE_TONE[presence]}>{presence}</Pill>}
                />
              ))}
            </PhoneList>
          }
        >
          {shown.map(({ operator, presence }) => (
            <Row key={operator.userId}>
              <Cell>
                <NameCell logoName={operator.fullName} logoSeed={operator.userId} name={operator.fullName} sub={operator.email ?? "No email"} />
              </Cell>
              <Cell>{operator.team}</Cell>
              <Cell muted>{operator.shift}</Cell>
              <Cell num align="right">
                {assigned.get(operator.userId) ?? 0}
              </Cell>
              <Cell>
                <Pill tone={PRESENCE_TONE[presence]}>{presence}</Pill>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
