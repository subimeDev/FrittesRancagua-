"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getAnnounceStatus,
  sendAnnounce,
  type AnnounceStatus,
} from "@/lib/api";

/**
 * Apartado OCULTO: enviar un anuncio a TODOS los clientes con la tarjeta en
 * Google Wallet (un addmessage a la clase → Google lo propaga a cada pase).
 *
 * Sin botón en la UI: se entra por URL directa `/anuncio`. Exige sesión de
 * manager. Tope diario propio (mostrado en pantalla) para no quemar el cupo de
 * Google ni molestar a los clientes.
 */
export default function AnuncioPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<AnnounceStatus | null>(null);
  const [header, setHeader] = useState("");
  const [body, setBody] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function goLogin(): void {
    router.replace("/login?next=/anuncio");
  }

  function loadStatus(t: string): void {
    void getAnnounceStatus(t)
      .then(setStatus)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          goLogin();
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setFeedback({ kind: "error", text: "Tu cuenta no tiene rol de manager." });
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    if (!t) {
      goLogin();
      return;
    }
    setToken(t);
    loadStatus(t);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || sending) return;
    setFeedback(null);

    const h = header.trim();
    const b = body.trim();
    if (!h || !b) {
      setFeedback({ kind: "error", text: "Escribe el título y el mensaje." });
      return;
    }
    if (
      !window.confirm(
        "Vas a enviar una notificación a TODOS los clientes con la tarjeta en Google Wallet. ¿Confirmas?",
      )
    ) {
      return;
    }

    setSending(true);
    try {
      const res = await sendAnnounce(token, h, b);
      setHeader("");
      setBody("");
      setFeedback({
        kind: "ok",
        text: `¡Enviado! Les llegará a tus clientes en unos minutos. Te quedan ${res.remaining_today} envíos hoy.`,
      });
      loadStatus(token);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
      const text = err instanceof ApiError ? err.message : "No se pudo enviar.";
      setFeedback({ kind: "error", text });
    } finally {
      setSending(false);
    }
  }

  const noQuota = status != null && status.remaining_today <= 0;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-8" style={{ background: "#F5F1E8", color: "#1A1815" }}>
      <header className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B6660" }}>
          Apartado oculto · anuncios
        </p>
        <h1 className="mt-1 text-2xl font-black">Enviar anuncio a clientes</h1>
        <p className="mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: "#EDE8DB", color: "#6B6660" }}>
          Manda una notificación a todos los clientes que tengan la tarjeta de
          Frittes guardada en Google Wallet. Úsalo para promos especiales — pocas
          veces, que valga la pena (si abusas, los clientes borran la tarjeta).
        </p>
      </header>

      {loading ? (
        <p className="text-sm" style={{ color: "#6B6660" }}>Cargando…</p>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          {status ? (
            <>
              {/* Clientes con la tarjeta en Google Wallet */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: "#1A1815", color: "#F5F1E8" }}
              >
                <span className="text-2xl">📲</span>
                <div>
                  <p className="text-2xl font-black leading-none" style={{ color: "#FFD23F" }}>
                    {status.saved_passes != null ? status.saved_passes : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: "#cdbfa4" }}>
                    {status.saved_passes === 1 ? "cliente tiene" : "clientes tienen"} la tarjeta en Google Wallet
                  </p>
                </div>
              </div>

              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 text-xs"
                style={{ background: "#FBF8F1", border: "1px solid #E2DCCC" }}
              >
                <span style={{ color: "#6B6660" }}>Anuncios enviados hoy: {status.sent_today}</span>
                <span className="font-bold" style={{ color: noQuota ? "#E55934" : "#2D5A3F" }}>
                  {status.remaining_today} disponibles hoy
                </span>
              </div>
            </>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Título</span>
            <input
              type="text"
              maxLength={60}
              placeholder="Finde de papas 🍟"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm"
              style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
            />
            <span className="mt-1 block text-right text-[10px]" style={{ color: "#6B6660" }}>
              {header.length}/60
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Mensaje</span>
            <textarea
              rows={3}
              maxLength={250}
              placeholder="Este sábado y domingo, 2x1 en papas grandes. ¡Te esperamos!"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full resize-none rounded-xl border px-4 py-2.5 text-sm"
              style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
            />
            <span className="mt-1 block text-right text-[10px]" style={{ color: "#6B6660" }}>
              {body.length}/250
            </span>
          </label>

          {/* Vista previa de cómo lo verá el cliente */}
          {(header.trim() || body.trim()) ? (
            <div className="rounded-xl px-4 py-3" style={{ background: "#1A1815", color: "#F5F1E8" }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#FFD23F" }}>
                Vista previa
              </p>
              <p className="mt-1 text-sm font-bold">{header.trim() || "Título"}</p>
              <p className="text-xs" style={{ color: "#cdbfa4" }}>{body.trim() || "Mensaje…"}</p>
            </div>
          ) : null}

          {feedback ? (
            <p
              className="rounded-xl px-3 py-2 text-xs"
              style={
                feedback.kind === "ok"
                  ? { background: "rgba(45,90,63,0.1)", color: "#2D5A3F" }
                  : { background: "rgba(229,89,52,0.1)", color: "#E55934" }
              }
            >
              {feedback.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending || noQuota}
            className="min-h-[48px] w-full rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50"
            style={{ background: "#1A1815", color: "#FFD23F" }}
          >
            {sending ? "Enviando…" : noQuota ? "Sin envíos disponibles hoy" : "Enviar a todos los clientes"}
          </button>
        </form>
      )}
    </main>
  );
}
