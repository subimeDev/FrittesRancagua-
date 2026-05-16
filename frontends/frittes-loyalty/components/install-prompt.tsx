"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton(): JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred) return null;

  return (
    <section className="mx-auto mt-6 max-w-sm">
      <button
        type="button"
        onClick={() => {
          void deferred.prompt();
          void deferred.userChoice.then(() => setDeferred(null));
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-cream-elev px-5 py-3.5 text-sm font-semibold text-ink shadow-card transition active:scale-[0.98]"
      >
        <svg
          aria-hidden
          className="h-4 w-4 flex-none text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 17V3" />
          <path d="m6 11 6 6 6-6" />
          <path d="M19 21H5" />
        </svg>
        Instalar app
      </button>
    </section>
  );
}
