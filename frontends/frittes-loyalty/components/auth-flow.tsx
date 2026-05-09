"use client";

import { useState, type FormEvent } from "react";

import { PhoneStep } from "@/components/auth/phone-step";
import { track } from "@/lib/analytics";
import type { FrittesBranding } from "@/lib/branding";
import { useAuth } from "@/lib/use-auth";
import { useEffect } from "react";

type AuthFlowProps = {
  branding: FrittesBranding;
  onAuthenticated: () => void;
};

export function AuthFlow({ branding, onAuthenticated }: AuthFlowProps): JSX.Element {
  const { state, submitEmail, completeProfile } = useAuth();
  const loading = state.step === "loading";
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    track("signup_started");
  }, []);

  if (state.step === "authenticated") {
    onAuthenticated();
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!agreed || name.trim().length < 2) return;
    await completeProfile({ customerName: name });
    onAuthenticated();
  }

  return (
    <section className="mx-auto max-w-md space-y-5">
      <header className="relative overflow-hidden rounded-pass bg-cream-elev p-8 shadow-card">
        <div className="blob-mustard-tl" />
        <div className="blob-forest-bl" />
        <div className="relative text-center">
          <img
            src="/frittes-logo.jpg"
            alt="Frittes Maison"
            className="mx-auto h-44 w-auto object-contain"
          />
          <p className="mt-3 text-sm text-ink-muted">{branding.tagline}</p>
        </div>
      </header>

      {state.step === "email-input" || (state.step === "loading" && !state.email) ? (
        <PhoneStep
          loading={loading}
          errorMessage={state.error?.message}
          onSubmit={submitEmail}
        />
      ) : null}

      {state.step === "profile-input" || (state.step === "loading" && Boolean(state.email) && !state.customer) ? (
        <form
          onSubmit={(event) => {
            void handleProfileSubmit(event);
          }}
          className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">Bienvenido</p>
            <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">Crea tu pase</h2>
            <p className="mt-1 text-xs text-ink-muted">{state.email}</p>
          </div>
          <input
            required
            type="text"
            placeholder="Nombre y apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink"
          />
          <label className="flex items-start gap-2 text-xs text-ink-muted">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>
              Al crear tu pase, aceptas nuestra{" "}
              <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="underline">
                politica de privacidad
              </a>{" "}
              y{" "}
              <a href="/legal/terminos" target="_blank" rel="noreferrer" className="underline">
                terminos del programa
              </a>
              .
            </span>
          </label>
          {state.error ? <p className="text-xs text-ember">{state.error.message}</p> : null}
          <button
            type="submit"
            disabled={loading || !agreed || name.trim().length < 2}
            className="inline-flex w-full items-center justify-center rounded-xl bg-mustard px-6 py-3.5 text-base font-bold text-ink transition disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Crear mi pase"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
