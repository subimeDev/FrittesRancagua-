"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { ApiError, staffLogin } from "@/lib/api";

// Solo permitimos redirigir a rutas internas (empiezan con "/" pero no "//")
// para que `?next=` no pueda usarse como open-redirect a un dominio externo.
function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNext(searchParams.get("next"));
  const [mode, setMode] = useState<"login" | "forgot" | "forgot_sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const session = await staffLogin(email, password);
      localStorage.setItem("frittes-pos:session", session.session_token);
      localStorage.setItem("frittes-pos:staff", JSON.stringify(session.staff));
      router.push(nextPath);
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

  async function onForgot(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch(`${API_URL}/loyalty/staff/auth/request-password-reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Restaurant-Id": RESTAURANT_ID,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setMode("forgot_sent");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

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
            POS · Punto de venta
          </p>
        </div>

        {mode === "login" && (
          <form
            onSubmit={onLogin}
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
            <button
              type="button"
              onClick={() => { setError(null); setMode("forgot"); }}
              className="w-full text-center text-xs text-ink-muted underline-offset-2 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form
            onSubmit={onForgot}
            className="space-y-3 rounded-2xl border border-line bg-white p-6 shadow-sm"
          >
            <div>
              <h1 className="text-xl font-bold text-ink">Restablecer contraseña</h1>
              <p className="text-xs text-black/50">
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
            </div>
            <input
              type="email"
              required
              placeholder="email@frittes.cl"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setMode("login"); }}
              className="w-full text-center text-xs text-ink-muted underline-offset-2 hover:underline"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}

        {mode === "forgot_sent" && (
          <div className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm text-center">
            <p className="text-4xl">📧</p>
            <h1 className="text-xl font-bold text-ink">Revisa tu correo</h1>
            <p className="text-sm text-ink-muted">
              Si <strong>{email}</strong> corresponde a una cuenta activa, recibirás un enlace para
              restablecer tu contraseña en los próximos minutos.
            </p>
            <button
              type="button"
              onClick={() => { setError(null); setMode("login"); }}
              className="w-full rounded-xl bg-ink px-4 py-3 font-bold text-white transition active:scale-95"
            >
              Volver al inicio de sesión
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
