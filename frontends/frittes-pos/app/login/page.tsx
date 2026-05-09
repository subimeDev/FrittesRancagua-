"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError, staffLogin } from "@/lib/api";

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await staffLogin(email, password);
      localStorage.setItem("frittes-pos:session", session.session_token);
      localStorage.setItem("frittes-pos:staff", JSON.stringify(session.staff));
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Credenciales incorrectas.");
      } else {
        setError("Error de conexión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-md place-items-center bg-cream px-6">
      <div className="w-full space-y-6">
        <div className="text-center">
          <img
            src="/frittes-logo.jpg"
            alt="Frittes Maison"
            className="mx-auto h-44 w-auto object-contain"
            style={{ mixBlendMode: "multiply" }}
          />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-black/40">
            POS · Punto de venta
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-sm"
        >
          <div>
            <h1 className="text-xl font-bold text-ink">Ingreso staff</h1>
            <p className="text-xs text-black/50">Solo personal autorizado.</p>
          </div>
          <input
            type="email"
            required
            placeholder="email@frittes.cl"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
          />
          <input
            type="password"
            required
            placeholder="********"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95 disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
