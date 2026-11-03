import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { getStockMovements } from "@/features/supplier/queries";
import {
  MOVEMENT_PILL,
  MOVEMENT_TYPES,
  movementReason,
  movementSource,
  movementUnits,
  parseMovementType,
  signedUnits,
  stockHistoryHref,
} from "@/features/supplier/stock";
import { Cell, DataTable, Row, type Column } from "@/ui/DataTable";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { LinkButton } from "@/ui/LinkButton";
import { FilterTabs, PageHeader } from "@/ui/PageHeader";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Stock history · Tradelink" };

const LIMIT = 200;

const COLUMNS: Column[] = [
  { label: "Time", className: "w-32" },
  { label: "Product" },
  { label: "Change", className: "w-28" },
  { label: "Units", align: "right", className: "w-24" },
  { label: "Reason", className: "w-40" },
  { label: "Source" },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockHistoryPage({ searchParams }: Props) {
  const session = await requireRole("supplier");
  const params = await searchParams;
  const raw = params.type;
  const type = parseMovementType((Array.isArray(raw) ? raw[0] : raw) ?? "");
  const movements = await getStockMovements(LIMIT);
  const shown = type ? movements.filter((movement) => movement.type === type) : movements;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Stock history"
        description={`Every stock change for ${session.orgName}, newest first. Reservations count reserved units; the rest count units on hand.`}
        actions={<LinkButton href="/supplier/inventory">Open inventory</LinkButton>}
      />
      <FilterTabs
        label="Show stock changes"
        tabs={[
          { href: stockHistoryHref(null), label: "All", count: movements.length, current: type === null },
          ...MOVEMENT_TYPES.map((each) => ({
            href: stockHistoryHref(each),
            label: MOVEMENT_PILL[each].label,
            count: movements.filter((movement) => movement.type === each).length,
            current: each === type,
          })),
        ]}
      />
      {shown.length === 0 ? (
        <EmptyState>{type ? `No ${MOVEMENT_PILL[type].label.toLowerCase()} stock changes yet.` : "No stock changes yet."}</EmptyState>
      ) : (
        <DataTable
          label="Stock changes"
          columns={COLUMNS}
          footer={movements.length === LIMIT ? `Showing the latest ${LIMIT} changes.` : undefined}
          phone={
            <RecordList>
              {shown.map((movement) => {
                const pill = MOVEMENT_PILL[movement.type];
                return (
                  <RecordCard
                    key={movement.id}
                    lead={<ProductArt kind={movement.art} size={36} />}
                    title={movement.productName}
                    sub={<time dateTime={movement.createdAt}>{formatDateTime(movement.createdAt)}</time>}
                    pill={<Pill tone={pill.tone}>{pill.label}</Pill>}
                    metrics={[
                      { label: "Units", value: signedUnits(movementUnits(movement)) },
                      { label: "Source", value: movementSource(movement) },
                    ]}
                  />
                );
              })}
            </RecordList>
          }
        >
          {shown.map((movement) => {
            const pill = MOVEMENT_PILL[movement.type];
            const reserved = movement.type === "reserved" || movement.type === "released";
            return (
              <Row key={movement.id}>
                <Cell num muted>
                  <time dateTime={movement.createdAt}>{formatDateTime(movement.createdAt)}</time>
                </Cell>
                <Cell>
                  <span className="flex items-center gap-2.5">
                    <ProductArt kind={movement.art} size={24} />
                    <span className="font-semibold">{movement.productName}</span>
                  </span>
                </Cell>
                <Cell>
                  <Pill tone={pill.tone}>{pill.label}</Pill>
                </Cell>
                <Cell num strong align="right">
                  {signedUnits(movementUnits(movement))}
                  {reserved ? <span className="block text-[.72rem] font-medium text-muted">reserved</span> : null}
                </Cell>
                <Cell muted>{movementReason(movement) ?? "—"}</Cell>
                <Cell>{movement.source}</Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
