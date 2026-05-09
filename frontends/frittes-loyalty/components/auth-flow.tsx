"use client";

import { useState, type FormEvent } from "react";

import { CodeStep } from "@/components/auth/code-step";
import { PhoneStep } from "@/components/auth/phone-step";
import { FrittesMark } from "@/components/frittes-mark";
import { track } from "@/lib/analytics";
import type { FrittesBranding } from "@/lib/branding";
import { useAuth } from "@/lib/use-auth";
import { useEffect } from "react";

type AuthFlowProps = {
  branding: FrittesBranding;
  onAuthenticated: () => void;
};

export function AuthFlow({ branding, onAuthenticated }: AuthFlowProps): JSX.Element {
  const { state, requestOtp, verifyOtp, completeProfile, resendSecondsLeft } = useAuth();
  const loading = state.step === "loading";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
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
    await completeProfile({ customerName: name, email: email || undefined });
    onAuthenticated();
  }

  return (
    <section className="mx-auto max-w-md space-y-5">
      <header className="relative overflow-hidden rounded-pass bg-cream-elev p-8 shadow-card">
        <div className="blob-mustard-tl" />
        <div className="blob-forest-bl" />
        <div className="relative text-center">
          <FrittesMark className="mx-auto h-20 w-20" />
          <h1 className="mt-3 font-display text-5xl font-bold leading-none tracking-tight text-ink">FRITTES</h1>
          <p className="-mt-1 font-script text-3xl text-ink">- maison -</p>
          <p className="mt-4 text-sm text-ink-muted">{branding.tagline}</p>
        </div>
      </header>

      {state.step === "phone-input" || (state.step === "loading" && !state.phone) ? (
        <PhoneStep
          loading={loading}
          errorMessage={state.error?.message}
          onSubmit={requestOtp}
        />
      ) : null}

      {state.step === "code-input" || (state.step === "loading" && Boolean(state.phone) && !state.token) ? (
        <CodeStep
          loading={loading}
          errorMessage={state.error?.message}
          resendSecondsLeft={resendSecondsLeft}
          onVerify={verifyOtp}
          onResend={() => requestOtp(state.phone)}
        />
      ) : null}

      {state.step === "profile-input" || (state.step === "loading" && Boolean(state.token) && !state.customer) ? (
        <form
          onSubmit={(event) => {
            void handleProfileSubmit(event);
          }}
          className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">Ultimo paso</p>
            <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">Completa tu perfil</h2>
          </div>
          <input
            required
            type="text"
            placeholder="Nombre y apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink"
          />
          <input
            type="email"
            placeholder="Email (opcional)"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
