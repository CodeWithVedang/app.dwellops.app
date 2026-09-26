"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SocietyError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">We couldn&apos;t load this page. Check your connection and try again.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/societies" className="inline-flex h-9 items-center px-3 text-sm text-primary hover:underline">
          Back to societies
        </Link>
      </div>
    </div>
  );
}
