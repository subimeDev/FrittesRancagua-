"use client";

import { useEffect, useState, type FormEvent } from "react";

import { apiRequest } from "@/lib/api";

type CheckStatus = "idle" | "checking" | "found" | "new";

type PhoneStepProps = {
  loading: boolean;
  onSubmit: (email: string) => Promise<void>;
  errorMessage?: string;
};

export function PhoneStep({ loading, onSubmit, errorMessage }: PhoneStepProps): JSX.Element {
  const [email, setEmail] = useState("");
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");
  const [foundName, setFoundName] = useState<string | null>(null);
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (!isValid) {
      setCheckStatus("idle");
      setFoundName(null);
      return;
    }
    setCheckStatus("checking");
    const timer = window.setTimeout(() => {
      void apiRequest<{ exists: boolean; name?: string }>(
        `/loyalty/customers/check?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      )
        .then((data) => {
          if (data.exists) {
            setFoundName(data.name ?? null);
            setCheckStatus("found");
          } else {
            setFoundName(null);
            setCheckStatus("new");
          }
        })
        .catch(() => {
          setCheckStatus("idle");
        });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [email, isValid]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValid || loading) return;
    await onSubmit(email.trim().toLowerCase());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">Acceso seguro</p>
        <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">Ingresa tu email</h2>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Correo electrónico</span>
        <div className="relative">
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 pr-10 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/30"
          />
          {/* Inline status icon */}
          {checkStatus === "checking" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base animate-pulse">⏳</span>
          )}
          {checkStatus === "found" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base">✓</span>
          )}
          {checkStatus === "new" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base">✨</span>
          )}
        </div>
      </label>

      {/* Status message */}
      {checkStatus === "found" && foundName ? (
        <p className="text-xs font-semibold text-forest">
          ¡Hola de nuevo, {foundName}! Te enviaremos un código a este correo.
        </p>
      ) : checkStatus === "new" ? (
        <p className="text-xs text-ink-muted">
          Correo no registrado — te daremos la bienvenida al verificar.
        </p>
      ) : null}

      {errorMessage ? <p className="text-xs text-ember">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!isValid || loading || checkStatus === "checking"}
        className="inline-flex w-full items-center justify-center rounded-xl bg-mustard px-6 py-3.5 text-base font-bold text-ink transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar código"}
      </button>
    </form>
  );
}
