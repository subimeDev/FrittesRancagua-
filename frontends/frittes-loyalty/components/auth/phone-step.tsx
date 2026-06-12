"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";

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
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card"
    >
      <div>
        <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-forest" strokeWidth={2} />
          Acceso seguro
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          Entra con tu correo
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Si ya tienes pase, entras directo. Si no, lo creamos en un minuto.
        </p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Correo electrónico</span>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted/60"
            strokeWidth={2}
            aria-hidden
          />
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream py-3 pl-10 pr-10 text-sm text-ink placeholder:text-ink-muted/50 transition"
          />
          {checkStatus === "checking" && (
            <Loader2
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-muted"
              aria-label="Verificando correo"
            />
          )}
          {checkStatus === "found" && (
            <CheckCircle2
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forest"
              aria-label="Correo registrado"
            />
          )}
          {checkStatus === "new" && (
            <Sparkles
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mustard-deep"
              aria-label="Correo nuevo"
            />
          )}
        </div>
      </label>

      {checkStatus === "found" && foundName ? (
        <p className="text-xs font-semibold text-forest">
          ¡Hola de nuevo, {foundName}! Toca para entrar.
        </p>
      ) : checkStatus === "new" ? (
        <p className="text-xs text-ink-muted">
          Correo nuevo — te pediremos tu nombre en el siguiente paso.
        </p>
      ) : null}

      {errorMessage ? <p className="text-xs text-ember">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!isValid || loading || checkStatus === "checking"}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-mustard-deep px-6 py-3.5 text-base font-bold text-ink shadow-card transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Entrando...
          </>
        ) : checkStatus === "found" ? (
          <>
            Entrar
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        ) : (
          <>
            Continuar
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>

      <p className="text-center text-[10px] text-ink-muted">
        Sin contraseñas — usamos tu correo solo para identificar tu pase.
      </p>
    </form>
  );
}
