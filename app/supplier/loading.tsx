/** Skeleton while a supplier page loads (SH-06). */
export default function SupplierLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="h-8 w-56 animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />
      <div aria-hidden="true" className="grid grid-cols-2 gap-2.5 min-[620px]:grid-cols-4">
        {[0, 1, 2, 3].map((tile) => (
          <div key={tile} className="h-[68px] animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        {[0, 1, 2].map((card) => (
          <div key={card} className="h-32 animate-pulse rounded-lg bg-sunken motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
