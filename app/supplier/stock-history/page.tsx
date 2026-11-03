import type { Metadata } from "next";
import { requireRole } from "@/data/session";
import { PageHead } from "@/features/supplier/PageHead";
import { getStockMovements } from "@/features/supplier/queries";
import { MOVEMENT_PILL, movementSource, movementUnits, signedUnits } from "@/features/supplier/stock";
import { EmptyState } from "@/ui/EmptyState";
import { formatDateTime } from "@/ui/format";
import { Pill } from "@/ui/Pill";
import { ProductArt } from "@/ui/ProductArt";
import { RecordCard, RecordList } from "@/ui/RecordCard";

export const metadata: Metadata = { title: "Stock history · Tradelink" };

export default async function StockHistoryPage() {
  const session = await requireRole("supplier");
  const movements = await getStockMovements();

  return (
    <>
      <PageHead title="Stock history">Every stock change for {session.orgName}, newest first.</PageHead>
      {movements.length === 0 ? (
        <EmptyState>No stock changes yet.</EmptyState>
      ) : (
        <RecordList>
          {movements.map((movement) => {
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
      )}
    </>
  );
}
