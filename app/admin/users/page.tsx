import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { OrgStatusPill } from "@/features/admin/components/Layout";
import { NameCell, PhoneList, PhoneRow } from "@/features/admin/components/Rows";
import { ROLE_ACCESS, ROLE_LABEL } from "@/features/admin/labels";
import { EMPTY_STATS, statsByOrg } from "@/features/admin/orderStats";
import { listHref, matchesSearch, param, searchText, type SearchParams } from "@/features/admin/params";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { getAccounts } from "@/features/admin/queries/people";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { Cell, DataTable, Row, RowLink } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader, SearchBox } from "@/ui/PageHeader";

export const metadata: Metadata = { title: "Users" };

type View = "buyers" | "accounts";

const BUYER_COLUMNS = [
  { label: "Buyer" },
  { label: "Contact" },
  { label: "Address" },
  { label: "Open orders", align: "right" as const, className: "w-28" },
  { label: "Order value", align: "right" as const, className: "w-32" },
  { label: "Status", className: "w-36" },
];

const ACCOUNT_COLUMNS = [
  { label: "Name" },
  { label: "Organisation" },
  { label: "Role", className: "w-24" },
  { label: "Access" },
  { label: "Status", className: "w-36" },
];

function joined(parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("admin");
  const params = await searchParams;
  const view: View = param(params, "view") === "accounts" ? "accounts" : "buyers";
  const q = searchText(params);
  const [buyers, accounts, orderRows] = await Promise.all([getOrganisations("buyer"), getAccounts(), getOrderStatRows()]);
  const orders = statsByOrg(orderRows);

  const shownBuyers = buyers.filter((buyer) => matchesSearch(q, [buyer.name, buyer.contactName, buyer.email, buyer.phone, buyer.address]));
  const shownAccounts = accounts.filter((account) =>
    matchesSearch(q, [account.fullName, account.email, account.org.name, ROLE_LABEL[account.org.kind]]),
  );
  const href = (next: View, search: string) => listHref("/admin/users", { view: next === "buyers" ? null : next, q: search });
  const empty = q ? `Nothing matches "${q}" here.` : view === "buyers" ? "No buyers yet." : "No accounts yet.";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Users"
        description="Buyer businesses, plus every account and what its role can reach."
        actions={
          <SearchBox
            action="/admin/users"
            label="Search users"
            placeholder="Name, business or email"
            defaultValue={q}
            keep={{ view: view === "buyers" ? undefined : view }}
          />
        }
      />
      <FilterTabs
        label="Show users"
        tabs={[
          { href: href("buyers", q), label: "Buyers", count: shownBuyers.length, current: view === "buyers" },
          { href: href("accounts", q), label: "All accounts", count: shownAccounts.length, current: view === "accounts" },
        ]}
      />
      {q ? (
        <p className="flex flex-wrap items-center gap-x-3 text-[.84rem] text-muted">
          <span>
            Results for <b className="text-ink">{q}</b>
          </span>
          <LinkButton variant="text" href={href(view, "")}>
            Clear search
          </LinkButton>
        </p>
      ) : null}

      {(view === "buyers" ? shownBuyers.length : shownAccounts.length) === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : view === "buyers" ? (
        <DataTable
          label="Buyers"
          columns={BUYER_COLUMNS}
          phone={
            <PhoneList label="Buyers">
              {shownBuyers.map((buyer) => {
                const stats = orders.get(buyer.id) ?? EMPTY_STATS;
                return (
                  <PhoneRow
                    key={buyer.id}
                    href={`/admin/users/buyers/${buyer.id}`}
                    lead={<BusinessLogo name={buyer.name} size={36} />}
                    title={buyer.name}
                    sub={
                      <>
                        {joined([buyer.contactName, buyer.address]) || "No contact details"}
                        <br />
                        {joined([buyer.phone, buyer.email])}
                        {buyer.phone || buyer.email ? <br /> : null}
                        {stats.open} open orders · {formatMoney(stats.valueCents)}
                      </>
                    }
                    end={<OrgStatusPill status={buyer.status} />}
                  />
                );
              })}
            </PhoneList>
          }
        >
          {shownBuyers.map((buyer) => {
            const stats = orders.get(buyer.id) ?? EMPTY_STATS;
            return (
              <Row key={buyer.id}>
                <Cell>
                  <NameCell
                    logoName={buyer.name}
                    name={<RowLink href={`/admin/users/buyers/${buyer.id}`}>{buyer.name}</RowLink>}
                    sub={buyer.contactName ?? "No contact person"}
                  />
                </Cell>
                <Cell muted className="max-w-[14rem]">
                  <span className="block truncate">{buyer.phone ?? "No phone"}</span>
                  <span className="block truncate">{buyer.email ?? "No email"}</span>
                </Cell>
                <Cell muted className="max-w-[14rem]">
                  <span className="line-clamp-2">{buyer.address ?? "Not given"}</span>
                </Cell>
                <Cell num align="right">
                  {stats.open}
                </Cell>
                <Cell num strong align="right">
                  {formatMoney(stats.valueCents)}
                </Cell>
                <Cell>
                  <OrgStatusPill status={buyer.status} />
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      ) : (
        <DataTable
          label="Accounts"
          columns={ACCOUNT_COLUMNS}
          phone={
            <PhoneList label="Accounts">
              {shownAccounts.map((account) => (
                <PhoneRow
                  key={account.userId}
                  lead={<BusinessLogo name={account.org.name} size={36} />}
                  title={account.fullName}
                  sub={
                    <>
                      {joined([account.org.name, account.email])}
                      <br />
                      {ROLE_LABEL[account.org.kind]}: {ROLE_ACCESS[account.org.kind]}
                    </>
                  }
                  end={<OrgStatusPill status={account.org.status} />}
                />
              ))}
            </PhoneList>
          }
        >
          {shownAccounts.map((account) => (
            <Row key={account.userId}>
              <Cell>
                <NameCell logoName={account.fullName} logoSeed={account.userId} name={account.fullName} sub={account.email ?? "No email"} />
              </Cell>
              <Cell>
                <span className="flex min-w-0 items-center gap-2">
                  <BusinessLogo name={account.org.name} size={22} />
                  <span className="truncate">{account.org.name}</span>
                </span>
              </Cell>
              <Cell>{ROLE_LABEL[account.org.kind]}</Cell>
              <Cell muted>{ROLE_ACCESS[account.org.kind]}</Cell>
              <Cell>
                <OrgStatusPill status={account.org.status} />
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
