"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UiState = "scanner" | "customer-card" | "confirmation";

/**
 * TODO backend POS:
 * - POST /api/v1/loyalty/staff/auth/login
 * - POST /api/v1/loyalty/transactions/accrue { qr_token } -> balance
 * - POST /api/v1/loyalty/transactions/redeem { qr_token } -> balance
 * - Registrar staff_user_id en cada transaccion para auditoria
 */
export default function PosHomePage(): JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<UiState>("scanner");
  const [feedback, setFeedback] = useState("");
  const [stamps, setStamps] = useState(6);

  useEffect(() => {
    if (!localStorage.getItem("frittes-pos:session")) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (state !== "confirmation") return;
    const t = window.setTimeout(() => setState("scanner"), 3000);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Frittes POS</h1>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1 text-sm"
          onClick={() => {
            localStorage.removeItem("frittes-pos:session");
            router.push("/login");
          }}
        >
          Salir
        </button>
      </header>

      {state === "scanner" ? (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Scanner</h2>
          <div className="grid h-56 place-items-center rounded-lg border-2 border-dashed border-line bg-cream">
            <p className="text-sm text-black/60">Camara activa / lector QR (mock)</p>
          </div>
          <button
            type="button"
            className="w-full rounded-lg bg-ink px-4 py-3 font-semibold text-white"
            onClick={() => setState("customer-card")}
          >
            Simular QR detectado
          </button>
        </section>
      ) : null}

      {state === "customer-card" ? (
        <section className="space-y-4 rounded-xl border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Cliente detectado</h2>
          <p className="text-sm text-black/70">Maria Perez · Tier Maisonero · Ultima visita: Hoy</p>
          <p className="text-3xl font-bold">{stamps} / 10 sellos</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg bg-forest px-4 py-4 text-lg font-bold text-white"
              onClick={() => {
                const next = stamps + 1;
                setStamps(next);
                setFeedback(`✓ Sello sumado a Maria. Ahora tiene ${next}/10.`);
                setState("confirmation");
              }}
            >
              Sumar sello
            </button>
            <button
              type="button"
              disabled={stamps < 10}
              className="rounded-lg bg-mustard px-4 py-4 text-lg font-bold text-ink disabled:opacity-60"
              onClick={() => {
                const next = Math.max(stamps - 10, 0);
                setStamps(next);
                setFeedback(`✓ Premio canjeado. Ahora tiene ${next}/10.`);
                setState("confirmation");
              }}
            >
              Canjear premio
            </button>
          </div>
        </section>
      ) : null}

      {state === "confirmation" ? (
        <section className="rounded-xl border border-line bg-white p-6 text-center">
          <p className="text-xl font-semibold text-forest">{feedback}</p>
          <p className="mt-2 text-sm text-black/60">Volviendo a scanner en 3s...</p>
        </section>
      ) : null}
    </main>
  );
}
