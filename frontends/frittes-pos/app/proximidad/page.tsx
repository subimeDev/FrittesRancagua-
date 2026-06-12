"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError, getProximity, updateProximity, type Proximity } from "@/lib/api";

/**
 * Apartado OCULTO de proximidad (geofence de Google Wallet) para Frittes.
 *
 * No hay botón a esta página en ninguna parte del POS: se entra por URL directa
 * `/proximidad`. Es deliberado — la feature se cobra aparte, así que solo
 * llegamos acá cuando el cliente pagó. Igual exige sesión de manager (el
 * endpoint del backend valida require_manager).
 */
export default function ProximidadPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
    void getProximity(t)
      .then((p) => {
        setLat(p.latitude != null ? String(p.latitude) : "");
        setLng(p.longitude != null ? String(p.longitude) : "");
        setMessage(p.proximity_message ?? "");
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setFeedback({ kind: "error", text: "Necesitas iniciar sesión como manager." });
        } else {
          setFeedback({ kind: "error", text: "No se pudo cargar la configuración." });
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function applyResult(p: Proximity): void {
    setLat(p.latitude != null ? String(p.latitude) : "");
    setLng(p.longitude != null ? String(p.longitude) : "");
    setMessage(p.proximity_message ?? "");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || saving) return;
    setFeedback(null);

    const latNum = lat.trim() === "" ? null : Number(lat.trim());
    const lngNum = lng.trim() === "" ? null : Number(lng.trim());
    if ((latNum === null) !== (lngNum === null)) {
      setFeedback({ kind: "error", text: "Latitud y longitud deben ir juntas." });
      return;
    }
    if (latNum !== null && (Number.isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setFeedback({ kind: "error", text: "Latitud inválida (-90 a 90)." });
      return;
    }
    if (lngNum !== null && (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180)) {
      setFeedback({ kind: "error", text: "Longitud inválida (-180 a 180)." });
      return;
    }

    setSaving(true);
    try {
      const result = await updateProximity(token, {
        latitude: latNum,
        longitude: lngNum,
        proximity_message: message.trim() || null,
      });
      applyResult(result);
      setFeedback({ kind: "ok", text: "Guardado. El geofence se sincronizó con Google Wallet." });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "No se pudo guardar.";
      setFeedback({ kind: "error", text });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(): Promise<void> {
    if (!token || saving) return;
    if (!window.confirm("¿Apagar el geofence y borrar la ubicación?")) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await updateProximity(token, { clear: true });
      applyResult(result);
      setFeedback({ kind: "ok", text: "Geofence apagado." });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "No se pudo apagar.";
      setFeedback({ kind: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-8" style={{ background: "#F5F1E8", color: "#1A1815" }}>
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B6660" }}>
          Apartado oculto · proximidad
        </p>
        <h1 className="mt-1 text-2xl font-black">Notificación por cercanía</h1>
        <p className="mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: "#EDE8DB", color: "#6B6660" }}>
          Cuando un cliente con el pase guardado entra al radio del local, Google
          Wallet vuelve a mostrar su tarjeta en la pantalla de bloqueo, y el pase
          muestra la oferta de abajo como &quot;Al visitarnos&quot;. Solo Android.
        </p>
      </header>

      {loading ? (
        <p className="text-sm" style={{ color: "#6B6660" }}>Cargando…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Latitud</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="-34.170000"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-xl border px-4 py-2.5 text-sm"
                style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Longitud</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="-70.740000"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-xl border px-4 py-2.5 text-sm"
                style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
              />
            </label>
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: "#6B6660" }}>
            En Google Maps: mantén presionado sobre el local → las coordenadas
            aparecen arriba. Cópialas tal cual (lat, lng).
          </p>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Mensaje de la oferta</span>
            <textarea
              rows={2}
              maxLength={200}
              placeholder="Estás cerca de Frittes — 10% mostrando esto en caja."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full resize-none rounded-xl border px-4 py-2.5 text-sm"
              style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
            />
            <span className="mt-1 block text-right text-[10px]" style={{ color: "#6B6660" }}>
              {message.length}/200
            </span>
          </label>

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

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] flex-1 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-60"
              style={{ background: "#1A1815", color: "#FFD23F" }}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={saving}
              className="min-h-[44px] rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-60"
              style={{ borderColor: "#E2DCCC", color: "#6B6660" }}
            >
              Apagar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
