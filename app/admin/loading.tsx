const ROWS = ["a", "b", "c", "d"];

/** Skeleton while an admin page loads (SH-06). Purely visual; the live region announces the wait. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-8 w-56 max-w-full animate-pulse rounded-md bg-sunken" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-sunken" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2.5 min-[620px]:grid-cols-4">
        {ROWS.map((row) => (
          <div key={row} className="h-[68px] animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <div aria-hidden="true" className="flex flex-col gap-2.5">
        {ROWS.map((row) => (
          <div key={row} className="h-24 animate-pulse rounded-lg border border-line bg-surface shadow-card" />
        ))}
      </div>
    </div>
  );
}
