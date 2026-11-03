import { BusinessLogo } from "@/ui/BusinessLogo";
import { RecordCard, RecordList } from "@/ui/RecordCard";
import type { SupplierRecordRow } from "./queries";

/** On time, problems and cut-off for each connected active supplier the buyer has ordered from (BUY-40). */
export function SupplierRecordList({ rows }: { rows: SupplierRecordRow[] }) {
  return (
    <section aria-labelledby="supplier-record-title" className="flex flex-col gap-2.5">
      <h2 id="supplier-record-title">Supplier record</h2>
      {rows.length === 0 ? (
        <p className="text-muted">Your supplier record appears after your first order with a connected supplier.</p>
      ) : (
        <RecordList>
          {rows.map((row) => (
            <RecordCard
              key={row.id}
              lead={<BusinessLogo name={row.name} seedKey={row.id} />}
              title={row.name}
              metrics={[
                { label: "On time", value: row.onTime === null ? "No deliveries yet" : `${row.onTime}%` },
                { label: "Problems", value: row.problems },
                { label: "Cut-off", value: row.cutoff },
              ]}
            />
          ))}
        </RecordList>
      )}
    </section>
  );
}
