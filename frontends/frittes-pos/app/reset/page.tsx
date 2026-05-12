"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";

function ResetForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm text-center">
        <p className="text-4xl">⚠️</p>
        <p className="text-sm text-red-600">Enlace inválido o expirado. Solicita uno nuevo desde el inicio de sesión.</p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95"
        >
          Ir al inicio de sesión
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm text-center">
        <p className="text-4xl">✅</p>
        <h1 className="text-xl font-bold text-ink">Contraseña actualizada</h1>
        <p className="text-sm text-ink-muted">Ya puedes ingresar con tu nueva contraseña.</p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95"
        >
          Ir al inicio de sesión
        </button>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/loyalty/staff/auth/confirm-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Restaurant-Id": RESTAURANT_ID,
        },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        setError(body.detail ?? "El enlace es inválido o ha expirado. Solicita uno nuevo.");
        return;
      }
      setDone(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-bold text-ink">Nueva contraseña</h1>
        <p className="text-xs text-black/50">Elige una contraseña segura de al menos 8 caracteres.</p>
      </div>
      <input
        type="password"
        required
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
      />
      <input
        type="password"
        required
        placeholder="Confirmar contraseña"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar contraseña"}
      </button>
    </form>
  );
}

export default function ResetPage(): JSX.Element {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center bg-cream px-6">
      <div className="w-full space-y-6">
        <div className="text-center">
          <img
            src="/frittes-logo.png"
            alt="Frittes Maison"
            className="mx-auto h-44 w-auto object-contain"
          />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
            POS · Restablecer contraseña
          </p>
        </div>
        <Suspense>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
