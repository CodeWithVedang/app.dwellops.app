"use client";

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

const CHECK_EVERY_MS = 15 * 60 * 1000;

/**
 * Registers the service worker and shows a banner when a new deploy is waiting.
 * The new version only activates after the user taps "Update", so nobody loses a half-filled form.
 */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let reg: ServiceWorkerRegistration | undefined;
    let reloading = false;

    const watch = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          // "installed" with an existing controller = an update, not the first install.
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(sw);
            setDismissed(false);
          }
        });
      });
    };

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const check = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => undefined);
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        watch(r);
      })
      .catch(() => undefined);

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, []);

  if (!waiting || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto flex max-w-md animate-toast-in items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-2xl ring-1 ring-white/10 md:bottom-6"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
        <RefreshCw className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">New version available</span>
        <span className="block text-xs text-slate-400">Update now to get the latest fixes.</span>
      </span>
      <button
        type="button"
        disabled={updating}
        onClick={() => {
          setUpdating(true);
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
        className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold text-ink transition-colors hover:bg-amber-300 disabled:opacity-60"
      >
        {updating ? "Updating…" : "Update"}
      </button>
      <button type="button" onClick={() => setDismissed(true)} className="rounded-md p-1 text-slate-400 hover:text-white" aria-label="Later">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
