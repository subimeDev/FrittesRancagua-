"use client";

import { useState, type FormEvent } from "react";
import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";

type PhoneStepProps = {
  loading: boolean;
  onSubmit: (phone: string) => Promise<void>;
  errorMessage?: string;
};

function normalizePhone(raw: string): string {
  const parsed = parsePhoneNumberFromString(raw, "CL");
  if (!parsed) return raw;
  return parsed.number;
}

export function PhoneStep({ loading, onSubmit, errorMessage }: PhoneStepProps): JSX.Element {
  const [phone, setPhone] = useState("");
  const normalized = normalizePhone(phone);
  const isValid = isValidPhoneNumber(phone || "+56900000000", "CL") && normalized.startsWith("+56");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!isValid || loading) return;
    await onSubmit(normalized);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">Acceso seguro</p>
        <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">Ingresa tu telefono</h2>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">Telefono</span>
        <input
          required
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+56 9 1234 5678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/30"
        />
      </label>

      {!isValid && phone.trim() ? (
        <p className="text-xs text-ember">Usa formato chileno valido (+56 9 XXXX XXXX).</p>
      ) : null}
      {errorMessage ? <p className="text-xs text-ember">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={!isValid || loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-mustard px-6 py-3.5 text-base font-bold text-ink transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar codigo"}
      </button>
    </form>
  );
}
