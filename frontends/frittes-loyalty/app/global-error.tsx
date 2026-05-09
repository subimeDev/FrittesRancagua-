"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }): JSX.Element {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="es">
      <body className="grid min-h-screen place-items-center bg-cream px-6 text-ink">
        <div className="rounded-pass border border-line bg-cream-elev p-8 text-center shadow-card">
          <h1 className="font-display text-3xl">Algo no salio bien</h1>
          <p className="mt-2 text-sm text-ink-muted">Ya estamos avisados. Intenta refrescar.</p>
        </div>
      </body>
    </html>
  );
}
