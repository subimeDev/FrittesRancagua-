"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Capturar tan pronto como el módulo se carga — antes de que React hidrate.
// Así no se pierde el evento aunque el componente monte tarde (tras auth).
let _deferred: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent("pwa-installable"));
  });
}

export function InstallButton(): JSX.Element | null {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(_deferred);

  useEffect(() => {
    // Si el evento ya ocurrió antes del mount, tomar el valor capturado
    if (_deferred) setDeferred(_deferred);
    const onInstallable = (): void => { setDeferred(_deferred); };
    window.addEventListener("pwa-installable", onInstallable);
    return () => window.removeEventListener("pwa-installable", onInstallable);
  }, []);

  if (!deferred) return null;

  return (
    <section className="mx-auto mt-6 max-w-sm">
      <button
        type="button"
        onClick={() => {
          void deferred.prompt();
          void deferred.userChoice.then(() => {
            _deferred = null;
            setDeferred(null);
          });
        }}
        className="group flex w-full items-center gap-4 rounded-xl bg-ink px-5 py-4 text-left shadow-card transition active:scale-[0.98]"
      >
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mustard text-2xl text-ink">
          ↓
        </span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider2 text-cream/50">
            Acceso rápido
          </p>
          <p className="font-display text-base font-semibold text-cream">
            Instalar app
          </p>
        </div>
        <svg
          aria-hidden
          className="h-5 w-5 flex-none text-mustard transition-transform group-active:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </section>
  );
}
