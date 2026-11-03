import { redirect } from "next/navigation";

/** Availability was renamed Products. */
export default function BuyerAvailabilityPage() {
  redirect("/buyer/products");
}
