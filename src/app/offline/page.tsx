import { WifiOff } from "lucide-react";

export const metadata = { title: "You're offline" };
export const dynamic = "force-static";

// Precached by the service worker; shown when a page can't load without network.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-warning">
          <WifiOff className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted">
          Nivaso Plus needs a connection to show your society&apos;s latest updates. Check your internet and try again.
        </p>
        <a href="/societies" className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
          Try again
        </a>
      </div>
    </main>
  );
}
