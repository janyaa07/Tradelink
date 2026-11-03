import { Panel } from "@/ui/Panel";

const CAN = ["Read your order messages", "Suggest quantities", "Prepare orders for you to confirm", "Compare invoices with your orders"];
const CANNOT = [
  "Send an order without your confirmation",
  "Make payments",
  "Change bank details",
  "See other shops' orders or prices",
];

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-bold">{title}</h3>
      <ul className="flex flex-col gap-0.5 text-[.92rem]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** "What Tradelink can do", exactly as in the prototype (BUY-45). */
export function CanDoPanel() {
  return (
    <Panel title="What Tradelink can do">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-3.5 @min-[860px]:grid-cols-2">
        <List title="It can" items={CAN} />
        <List title="It cannot" items={CANNOT} />
      </div>
    </Panel>
  );
}
