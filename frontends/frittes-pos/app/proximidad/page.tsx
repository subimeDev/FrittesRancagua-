"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ApiError, getProximity, updateProximity, type Proximity } from "@/lib/api";

/**
 * Configuración de proximidad (geofence de Google Wallet) para Frittes.
 *
 * Accesible desde el panel admin (pestaña Wallet) o por URL directa. Exige
 * sesión de manager (el backend valida require_manager).
 *
 * Mapa: Leaflet + OpenStreetMap (sin API key). El manager hace clic en el mapa
 * o usa "mi ubicación" → lat/lng se calculan solas, sin copiar coordenadas.
 */

const FRITTES_DEFAULT: [number, number] = [-34.170417, -70.740189]; // Rancagua centro aprox.

// Etiqueta legible de un resultado de Photon (name, calle, comuna).
function photonLabel(p: any): string {
  const parts = [
    p.name,
    [p.street, p.housenumber].filter(Boolean).join(" "),
    p.city || p.district || p.county,
    p.state,
  ].filter(Boolean);
  // Dedup simple (a veces name == street).
  return Array.from(new Set(parts)).join(", ");
}

// Carga Leaflet desde CDN una sola vez (no es dependencia npm: la página es
// interna y poco visitada, no justifica sumar el bundle a todo el POS).
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) {
      resolve(w.L);
      return;
    }
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error("No se pudo cargar el mapa."));
    document.head.appendChild(script);
  });
}

export default function ProximidadPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ label: string; lat: number; lon: number }>>([]);

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const skipNextSearch = useRef(false);

  // Mantiene el marker sincronizado cuando lat/lng cambian por cualquier vía.
  function placeMarker(L: any, la: number, ln: number, recenter = true): void {
    if (!mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    } else {
      markerRef.current = L.marker([la, ln], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current.getLatLng();
        setLat(Number(p.lat.toFixed(6)));
        setLng(Number(p.lng.toFixed(6)));
      });
    }
    if (recenter) mapRef.current.setView([la, ln], Math.max(mapRef.current.getZoom(), 16));
  }

  function goLogin(): void {
    router.replace("/login?next=/proximidad");
  }

  // Auth + carga inicial.
  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    if (!t) {
      goLogin();
      return;
    }
    setToken(t);
    void getProximity(t)
      .then((p) => {
        if (p.latitude != null && p.longitude != null) {
          setLat(p.latitude);
          setLng(p.longitude);
        }
        setMessage(p.proximity_message ?? "");
      })
      .catch((err) => {
        // 401 = sesión vencida → re-login (vuelve acá). 403 = no es manager.
        if (err instanceof ApiError && err.status === 401) {
          goLogin();
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setFeedback({ kind: "error", text: "Tu cuenta no tiene rol de manager." });
        } else {
          setFeedback({ kind: "error", text: "No se pudo cargar la configuración." });
        }
      })
      .finally(() => setLoading(false));
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inicializa el mapa cuando el div ya está montado (post-loading).
  useEffect(() => {
    if (loading || !mapDivRef.current || mapRef.current) return;
    let cancelled = false;
    void loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        const center: [number, number] =
          lat != null && lng != null ? [lat, lng] : FRITTES_DEFAULT;
        mapRef.current = L.map(mapDivRef.current).setView(center, lat != null ? 16 : 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap",
        }).addTo(mapRef.current);
        if (lat != null && lng != null) placeMarker(L, lat, lng, false);
        mapRef.current.on("click", (e: any) => {
          const la = Number(e.latlng.lat.toFixed(6));
          const ln = Number(e.latlng.lng.toFixed(6));
          setLat(la);
          setLng(ln);
          placeMarker(L, la, ln, false);
        });
      })
      .catch(() => setFeedback({ kind: "error", text: "No se pudo cargar el mapa (revisa tu conexión)." }));
    return () => {
      cancelled = true;
    };
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autocompletado mientras escribes (Photon, geocoder OSM gratis sin API key).
  // Sesgado al centro de Rancagua (lat/lon bias) para que los lugares cercanos
  // salgan primero. Debounce de 300ms para no spamear el servicio.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || skipNextSearch.current) {
      skipNextSearch.current = false;
      setResults([]);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      const [blat, blon] = FRITTES_DEFAULT;
      const url =
        "https://photon.komoot.io/api/?lang=es&limit=6" +
        `&lat=${blat}&lon=${blon}&q=${encodeURIComponent(q)}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: any) => {
          const feats = Array.isArray(data?.features) ? data.features : [];
          const mapped = feats
            .filter((f: any) => f?.geometry?.coordinates?.length === 2)
            .map((f: any) => ({
              label: photonLabel(f.properties || {}),
              lon: f.geometry.coordinates[0],
              lat: f.geometry.coordinates[1],
              country: f.properties?.countrycode,
            }))
            // Chile primero, pero sin descartar el resto.
            .sort((a: any, b: any) => (b.country === "CL" ? 1 : 0) - (a.country === "CL" ? 1 : 0))
            .map(({ label, lat, lon }: any) => ({ label, lat, lon }));
          setResults(mapped);
        })
        .catch((e) => {
          if (e?.name !== "AbortError") {
            setFeedback({ kind: "error", text: "No se pudo buscar (revisa tu conexión)." });
          }
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function pickResult(r: { label: string; lat: number; lon: number }): void {
    const la = Number(r.lat.toFixed(6));
    const ln = Number(r.lon.toFixed(6));
    setLat(la);
    setLng(ln);
    setResults([]);
    skipNextSearch.current = true; // no re-buscar al setear el query con la etiqueta
    setQuery(r.label);
    const L = (window as any).L;
    if (L) placeMarker(L, la, ln);
  }

  function useMyLocation(): void {
    if (!navigator.geolocation) {
      setFeedback({ kind: "error", text: "Tu navegador no permite ubicación. Abre la página en Chrome." });
      return;
    }
    setFeedback({ kind: "ok", text: "Obteniendo tu ubicación…" });
    const onOk = (pos: GeolocationPosition): void => {
      const la = Number(pos.coords.latitude.toFixed(6));
      const ln = Number(pos.coords.longitude.toFixed(6));
      setLat(la);
      setLng(ln);
      const L = (window as any).L;
      if (L) placeMarker(L, la, ln);
      setFeedback({ kind: "ok", text: "Ubicación tomada. Ajusta el pin si hace falta." });
    };
    const onErr = (err: GeolocationPositionError): void => {
      const text =
        err.code === err.PERMISSION_DENIED
          ? "Bloqueaste la ubicación. Permítela en el candado 🔒 de la barra de direcciones y reintenta."
          : err.code === err.TIMEOUT
            ? "La ubicación tardó demasiado. Reintenta o marca el punto en el mapa."
            : "No pudimos obtener tu ubicación. Marca el punto en el mapa.";
      setFeedback({ kind: "error", text });
    };
    // Primer intento de alta precisión; si expira, reintento rápido con baja
    // precisión (suele resolver en interiores / sin GPS fino).
    navigator.geolocation.getCurrentPosition(onOk, () => {
      navigator.geolocation.getCurrentPosition(onOk, onErr, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || saving) return;
    setFeedback(null);
    if ((lat === null) !== (lng === null)) {
      setFeedback({ kind: "error", text: "Marca un punto en el mapa." });
      return;
    }
    setSaving(true);
    try {
      const result = await updateProximity(token, {
        latitude: lat,
        longitude: lng,
        proximity_message: message.trim() || null,
      });
      setMessage(result.proximity_message ?? "");
      setFeedback({ kind: "ok", text: "Guardado. El geofence se sincronizó con Google Wallet." });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
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
      setLat(null);
      setLng(null);
      setMessage(result.proximity_message ?? "");
      if (markerRef.current && mapRef.current) {
        mapRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
      setFeedback({ kind: "ok", text: "Geofence apagado." });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        goLogin();
        return;
      }
      const text = err instanceof ApiError ? err.message : "No se pudo apagar.";
      setFeedback({ kind: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-8" style={{ background: "#F5F1E8", color: "#1A1815" }}>
      <header className="mb-5">
        <button
          type="button"
          onClick={() => router.push("/admin?tab=wallet")}
          className="mb-3 text-xs font-medium"
          style={{ color: "#6B6660" }}
        >
          ← Volver al panel
        </button>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#6B6660" }}>
          Google Wallet · proximidad
        </p>
        <h1 className="mt-1 text-2xl font-black">Notificación por cercanía</h1>
        <p className="mt-3 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: "#EDE8DB", color: "#6B6660" }}>
          Marca el local en el mapa y escribe la oferta. Cuando un cliente con el
          pase guardado pase cerca, Google Wallet le muestra la tarjeta en la
          pantalla de bloqueo con tu mensaje. Solo Android.
        </p>
      </header>

      {loading ? (
        <p className="text-sm" style={{ color: "#6B6660" }}>Cargando…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Buscador inteligente con autocompletado */}
          <div className="relative">
            <input
              type="text"
              autoComplete="off"
              placeholder="🔍 Escribe el nombre o dirección del local…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm"
              style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
            />
            {searching ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#6B6660" }}>
                …
              </span>
            ) : null}
            {results.length > 0 ? (
              <ul
                className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-xl border shadow-lg"
                style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}
              >
                {results.map((r, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => pickResult(r)}
                      className="block w-full px-4 py-2.5 text-left text-xs leading-snug hover:bg-black/5"
                      style={{ color: "#1A1815", borderTop: i > 0 ? "1px solid #E2DCCC" : "none" }}
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Mapa interactivo */}
          <div
            ref={mapDivRef}
            className="w-full rounded-xl border"
            style={{ height: 280, borderColor: "#E2DCCC", background: "#EDE8DB" }}
          />
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={useMyLocation}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border px-3 text-xs font-semibold"
              style={{ borderColor: "#E2DCCC", color: "#1A1815" }}
            >
              📍 Usar mi ubicación
            </button>
            <span className="text-[11px]" style={{ color: "#6B6660" }}>
              {lat != null && lng != null
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                : "Toca el mapa para marcar"}
            </span>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Mensaje de la oferta</span>
            <textarea
              rows={2}
              maxLength={200}
              placeholder="Estás cerca de Frittes — 10% mostrando esto en caja 🍟"
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
