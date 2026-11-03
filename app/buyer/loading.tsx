export default function BuyerLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="h-8 w-40 animate-pulse rounded-md bg-sunken" />
      <div aria-hidden="true" className="h-28 animate-pulse rounded-lg bg-sunken" />
      <div aria-hidden="true" className="h-28 animate-pulse rounded-lg bg-sunken" />
    </div>
  );
}
