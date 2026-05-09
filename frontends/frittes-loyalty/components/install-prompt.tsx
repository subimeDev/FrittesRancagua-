"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "pwa-prompt:dismissed";

export function InstallPrompt(): JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    const handler = (event: Event): void => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (hidden || !deferred) return null;

  return (
    <div className="mx-auto mt-4 max-w-sm rounded-xl border border-line bg-cream-elev p-3 text-sm text-ink shadow-card">
      <p>Agrega Frittes a tu pantalla de inicio para acceso rapido.</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-mustard px-3 py-1.5 text-xs font-semibold"
          onClick={() => {
            void deferred.prompt();
            void deferred.userChoice.then((choice) => {
              if (choice.outcome === "dismissed") {
                localStorage.setItem(DISMISSED_KEY, "1");
              }
              setHidden(true);
            });
          }}
        >
          Agregar
        </button>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-xs"
          onClick={() => {
            localStorage.setItem(DISMISSED_KEY, "1");
            setHidden(true);
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
