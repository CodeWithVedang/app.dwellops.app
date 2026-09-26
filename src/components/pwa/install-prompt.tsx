"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { LogoMark } from "@/components/navigation/logo";

// Chromium-only event; not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "nivaso.install.dismissedAt";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 4000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * "Install Nivaso Plus" popup. Android/desktop Chrome & Edge: real install via beforeinstallprompt.
 * iPhone Safari has no install API, so we show the Share → Add to Home Screen steps instead.
 * Hidden when already installed, and snoozed for 14 days after "Not now".
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  // Popup stays closed until after mount, so reading the UA here cannot cause a hydration mismatch.
  const [ios] = useState(isIosSafari);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (standalone() || snoozed()) return;
    let timer: number | undefined;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      timer = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    };
    const onInstalled = () => setOpen(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (ios) timer = window.setTimeout(() => setOpen(true), SHOW_AFTER_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(timer);
    };
  }, [ios]);

  function dismiss() {
    setOpen(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode: just close */
    }
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === "accepted") setOpen(false);
    else dismiss();
  }

  if (!open || (!evt && !ios)) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="install-title"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 mx-auto max-w-md animate-toast-in rounded-2xl bg-surface p-4 shadow-2xl ring-1 ring-border md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <div className="flex items-start gap-3">
        <LogoMark className="size-11" />
        <div className="min-w-0 flex-1">
          <p id="install-title" className="font-display text-[15px] font-bold">
            Install Nivaso Plus
          </p>
          <p className="mt-0.5 text-xs text-muted">Open it from your home screen like an app. Faster, full-screen, and you&apos;ll see updates at a glance.</p>
        </div>
        <button type="button" onClick={dismiss} className="-m-1 rounded-lg p-1.5 text-subtle hover:bg-bg hover:text-text" aria-label="Not now">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {ios ? (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-bg p-3 text-[13px]">
          <li className="flex items-center gap-2">
            1. Tap <Share className="size-4 text-primary" aria-label="Share" /> at the bottom of Safari
          </li>
          <li className="flex items-center gap-2">
            2. Choose <SquarePlus className="size-4 text-primary" aria-hidden /> <strong>Add to Home Screen</strong>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-bg">
            Not now
          </button>
          <button type="button" onClick={() => void install()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
            Install app
          </button>
        </div>
      )}
    </div>
  );
}
