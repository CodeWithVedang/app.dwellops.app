// Instant feedback while a society page renders on the server. The sidebar/bottom bar (layout)
// stays interactive; only the main area swaps to this skeleton. Also lets <Link> prefetch
// up to this boundary, so clicks respond immediately.
function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-border/70 ${className}`} />;
}

export default function SocietyLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="mb-7 space-y-2.5" aria-hidden>
        <Bar className="h-7 w-48" />
        <Bar className="h-4 w-72 max-w-full" />
      </div>
      <div className="min-w-0 rounded-2xl bg-surface shadow-sm ring-1 ring-border" aria-hidden>
        <div className="border-b border-border px-5 py-3.5">
          <Bar className="h-4 w-32" />
        </div>
        <ul className="divide-y divide-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-4">
              <Bar className="size-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Bar className="h-3.5 w-3/5" />
                <Bar className="h-3 w-2/5" />
              </div>
              <Bar className="hidden h-6 w-20 rounded-full sm:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
