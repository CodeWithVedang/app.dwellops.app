import { requirePageContext } from "@/lib/auth/page";
import { unitLabel } from "@/lib/units";
import Link from "next/link";
import { Package, PackageCheck } from "lucide-react";
import { hasPermission } from "@/lib/auth/context";
import { parcelService } from "@/server/services/parcelService";
import { societyService } from "@/server/services/societyService";
import { EmptyState, PageHeader, Panel } from "@/components/ui/feedback";
import { HandoverControls, LogParcelForm } from "@/features/parcels/components/parcel-forms";
import { formatDateTime, relativeTime } from "@/lib/format";

export const metadata = { title: "Parcels" };

const VIEWS = [
  { key: "waiting", label: "Waiting" },
  { key: "collected", label: "Collected" },
  { key: "all", label: "All" },
] as const;

export default async function ParcelsPage({ params, searchParams }: PageProps<"/s/[slug]/parcels">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requirePageContext(slug);
  const gate = hasPermission(ctx, "parcel.view_all");
  const canLog = hasPermission(ctx, "parcel.log");
  const canHandover = hasPermission(ctx, "parcel.handover");
  const view = typeof sp.view === "string" && ["waiting", "collected", "all"].includes(sp.view) ? sp.view : "waiting";
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [parcels, units] = await Promise.all([
    parcelService.list(ctx, { view, q }),
    canLog ? societyService.listUnits(ctx) : Promise.resolve([]),
  ]);
  const base = `/s/${slug}/parcels`;

  const tabs = (
    <nav aria-label="Parcel views" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-border">
      {VIEWS.map((t) => (
        <Link
          key={t.key}
          href={t.key === "waiting" ? base : `${base}?view=${t.key}`}
          aria-current={view === t.key ? "page" : undefined}
          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${view === t.key ? "bg-ink text-white" : "text-muted hover:text-text"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );

  if (!gate) {
    return (
      <>
        <PageHeader eyebrow="Parcels" title="Your deliveries" description="When security receives something for your flat, it shows up here with a pickup code." />
        <div className="mb-5">{tabs}</div>
        {parcels.length === 0 ? (
          <EmptyState icon={Package} title={view === "waiting" ? "Nothing waiting at the gate" : "No parcels yet"} body="We'll notify you the moment a delivery arrives." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {parcels.map((p) => {
              const waiting = p.status === "RECEIVED" || p.status === "NOTIFIED";
              return (
                <li key={p.id} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
                  <div className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="font-display text-lg font-bold">{p.courier}</p>
                      <p className="text-xs text-muted">
                        #{p.number} · {unitLabel(p.unit)} · arrived {relativeTime(p.receivedAt)}
                      </p>
                      {p.storageLocation && <p className="mt-1 text-xs text-muted">Kept at {p.storageLocation}</p>}
                      {p.description && <p className="mt-1 text-xs text-muted">{p.description}</p>}
                    </div>
                    {!waiting && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-muted">
                        {p.status === "COLLECTED" ? "Collected" : "Returned"}
                      </span>
                    )}
                  </div>
                  {waiting && p.pickupCode ? (
                    <div className="flex items-center justify-between bg-ink px-4 py-3 text-white">
                      <span className="text-xs text-slate-400">Show this code at the gate</span>
                      <span className="font-mono text-2xl font-bold tracking-[0.35em] text-accent">{p.pickupCode}</span>
                    </div>
                  ) : (
                    p.collectedAt && (
                      <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
                        Collected by {p.collectedByName} · {formatDateTime(p.collectedAt)}
                      </p>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Parcel desk" title="Parcels at the gate" description="Log deliveries as they arrive. Residents get a pickup code; hand over only when it matches." />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {canLog && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Panel title="New delivery">
              {units.length === 0 ? (
                <p className="text-sm text-muted">Add flats under Buildings &amp; flats first.</p>
              ) : (
                <LogParcelForm
                  slug={slug}
                  units={units.map((u) => ({ id: u.id, label: u.unitNumber, building: u.building.code, hasResidents: u.members.length > 0 }))}
                />
              )}
            </Panel>
          </div>
        )}
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {tabs}
            <form role="search" className="flex gap-2">
              {view !== "waiting" && <input type="hidden" name="view" value={view} />}
              <label htmlFor="pq" className="sr-only">Search parcels</label>
              <input id="pq" name="q" defaultValue={q} placeholder="Flat, courier or tracking no." className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 sm:w-60" />
            </form>
          </div>
          {parcels.length === 0 ? (
            <EmptyState icon={PackageCheck} title={view === "waiting" ? "All parcels handed over" : "No parcels found"} body={view === "waiting" ? "Nothing is waiting at the gate right now." : "Try a different search."} />
          ) : (
            <ul className="space-y-2.5">
              {parcels.map((p) => {
                const waiting = p.status === "RECEIVED" || p.status === "NOTIFIED";
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface p-4 ring-1 ring-border">
                    <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-soft font-display leading-none text-primary-strong">
                      <span className="text-[10px] font-semibold uppercase">{p.unit.building.code}</span>
                      <span className="text-[15px] font-bold">{p.unit.unitNumber.replace(/^[A-Z]+-/, "")}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {p.courier} <span className="font-normal text-subtle">#{p.number}</span>
                      </p>
                      <p className={`text-xs ${p.stale ? "font-semibold text-warning" : "text-muted"}`}>
                        {waiting ? `Waiting ${relativeTime(p.receivedAt).replace(" ago", "")}` : p.status === "COLLECTED" ? `Collected by ${p.collectedByName}` : `Returned: ${p.notes ?? ""}`}
                        {p.storageLocation && ` · ${p.storageLocation}`}
                        {waiting && p.status === "RECEIVED" && " · resident not on app"}
                      </p>
                    </div>
                    {waiting && canHandover && (
                      <div className="w-full sm:w-auto sm:max-w-md">
                        <HandoverControls slug={slug} parcelId={p.id} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
