"use client";

import { useMemo, useRef, useState } from "react";

type CodeStepProps = {
  loading: boolean;
  resendSecondsLeft: number;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  errorMessage?: string;
};

export function CodeStep({
  loading,
  resendSecondsLeft,
  onVerify,
  onResend,
  errorMessage,
}: CodeStepProps): JSX.Element {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const code = useMemo(() => digits.join(""), [digits]);
  const isComplete = code.length === 6 && !digits.includes("");

  async function submitCode(): Promise<void> {
    if (!isComplete || loading) return;
    await onVerify(code);
  }

  return (
    <div className="space-y-4 rounded-pass border border-line bg-cream-elev p-6 shadow-card">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">Verificacion</p>
        <h2 className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-ink">Ingresa el código de tu email</h2>
      </div>

      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            className="h-12 w-12 rounded-lg border border-line bg-cream text-center text-lg font-semibold text-ink focus:border-mustard-deep focus:outline-none"
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "").slice(-1);
              setDigits((prev) => {
                const next = [...prev];
                next[index] = value;
                return next;
              });
              if (value && index < 5) refs.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
              if (!pasted) return;
              event.preventDefault();
              const next = ["", "", "", "", "", ""];
              pasted.split("").forEach((char, idx) => {
                next[idx] = char;
              });
              setDigits(next);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }}
          />
        ))}
      </div>

      {errorMessage ? <p className="text-xs text-ember">{errorMessage}</p> : null}

      <button
        type="button"
        onClick={() => {
          void submitCode();
        }}
        disabled={!isComplete || loading}
        className="inline-flex w-full items-center justify-center rounded-xl bg-mustard px-6 py-3.5 text-base font-bold text-ink transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Verificando..." : "Verificar"}
      </button>

      <button
        type="button"
        disabled={loading || resendSecondsLeft > 0}
        onClick={() => {
          void onResend();
        }}
        className="w-full text-xs font-medium text-ink-muted disabled:opacity-60"
      >
        {resendSecondsLeft > 0 ? `Reenviar en ${resendSecondsLeft}s` : "Reenviar codigo"}
      </button>
    </div>
  );
}
