import { redirect } from "next/navigation";

/** Ask was renamed Tradelink Assistant. */
export default function BuyerAskPage(): never {
  redirect("/buyer/assistant");
}
