import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { formatMoney } from "@/domain/money";
import { OrgStatusPill, PageHead, SectionHead } from "@/features/admin/components/Layout";
import { ROLE_ACCESS, ROLE_LABEL } from "@/features/admin/labels";
import { EMPTY_STATS, statsByOrg } from "@/features/admin/orderStats";
import { getOrderStatRows } from "@/features/admin/queries/orders";
import { getOrganisations } from "@/features/admin/queries/organisations";
import { getAccounts } from "@/features/admin/queries/people";
import { BusinessLogo } from "@/ui/BusinessLogo";
import { EmptyState } from "@/ui/EmptyState";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Users" };

function joined(parts: (string | null)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

export default async function UsersPage() {
  await requireRole("admin");
  const [buyers, accounts, orderRows] = await Promise.all([getOrganisations("buyer"), getAccounts(), getOrderStatRows()]);
  const orders = statsByOrg(orderRows);

  return (
    <>
      <PageHead title="Users" sub="Buyer details, plus every account and what its role can reach." />

      <SectionHead>Buyers</SectionHead>
      {buyers.length === 0 ? (
        <EmptyState>No buyers yet.</EmptyState>
      ) : (
        <RecordList>
          {buyers.map((buyer) => {
            const stats = orders.get(buyer.id) ?? EMPTY_STATS;
            return (
              <RecordCard
                key={buyer.id}
                lead={<BusinessLogo name={buyer.name} size={36} />}
                title={buyer.name}
                titleHref={`/admin/users/buyers/${buyer.id}`}
                sub={
                  <>
                    {joined([buyer.contactName, buyer.address]) || "No contact details"}
                    <br />
                    {joined([buyer.phone, buyer.email])}
                  </>
                }
                pill={<OrgStatusPill status={buyer.status} />}
                metrics={[
                  { label: "Open orders", value: stats.open },
                  { label: "Order value", value: formatMoney(stats.valueCents) },
                ]}
              />
            );
          })}
        </RecordList>
      )}

      <SectionHead>All accounts</SectionHead>
      {accounts.length === 0 ? (
        <EmptyState>No accounts yet.</EmptyState>
      ) : (
        <RecordList>
          {accounts.map((account) => (
            <RecordCard
              key={account.userId}
              lead={<BusinessLogo name={account.org.name} size={36} />}
              title={account.fullName}
              sub={joined([account.org.name, account.email])}
              pill={<OrgStatusPill status={account.org.status} />}
              metrics={[
                { label: "Role", value: ROLE_LABEL[account.org.kind] },
                { label: "Access", value: ROLE_ACCESS[account.org.kind] },
              ]}
            />
          ))}
        </RecordList>
      )}
    </>
  );
}
