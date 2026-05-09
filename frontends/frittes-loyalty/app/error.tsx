"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-6">
      <div className="rounded-pass border border-line bg-cream-elev p-8 text-center shadow-card">
        <h1 className="font-display text-3xl text-ink">Algo no salio bien</h1>
        <p className="mt-2 text-sm text-ink-muted">Ya estamos avisados. Intenta refrescar.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl bg-mustard px-4 py-2 font-semibold text-ink"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
