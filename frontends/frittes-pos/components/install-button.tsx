"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Capturar antes de que React hidrate para no perder el evento
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
    if (_deferred) setDeferred(_deferred);
    const onInstallable = (): void => { setDeferred(_deferred); };
    window.addEventListener("pwa-installable", onInstallable);
    return () => window.removeEventListener("pwa-installable", onInstallable);
  }, []);

  if (!deferred) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void deferred.prompt();
        void deferred.userChoice.then(() => {
          _deferred = null;
          setDeferred(null);
        });
      }}
      className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-ink px-6 py-4 text-left text-white shadow-card transition active:scale-[0.98]"
    >
      <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mustard text-2xl text-ink">
        ↓
      </span>
      <div className="flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Acceso rápido
        </p>
        <p className="text-base font-bold text-white">Instalar app</p>
      </div>
      <span className="text-xl text-white/30 transition-transform group-active:translate-x-1">›</span>
    </button>
  );
}
