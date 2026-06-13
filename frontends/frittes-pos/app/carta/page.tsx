"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  getMenu,
  saveMenu,
  type MenuCategoryData,
  type MenuItemData,
} from "@/lib/api";
import { FRITTES_MENU } from "@/lib/frittes-menu-seed";

/**
 * Editor de la carta (menú QR) de Frittes. Accesible desde el panel (pestaña
 * Carta) o por URL `/carta`. Exige sesión de manager.
 *
 * Modelo de edición: árbol completo en estado; al guardar se manda entero
 * (PUT bulk-replace). Precio en pesos CLP directos.
 */

function emptyItem(): MenuItemData {
  return {
    id: null,
    name: "",
    description: null,
    price_cents: 0,
    is_available: true,
    badge: null,
    image_url: null,
  };
}

function formatCLP(pesos: number): string {
  return `$${(pesos || 0).toLocaleString("es-CL")}`;
}

export default function CartaPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cats, setCats] = useState<MenuCategoryData[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function goLogin(): void {
    router.replace("/login?next=/carta");
  }

  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    if (!t) {
      goLogin();
      return;
    }
    setToken(t);
    void getMenu(t)
      .then((m) => setCats(m.categories.map((c) => ({ id: c.id, name: c.name, items: c.items }))))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          goLogin();
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setFeedback({ kind: "error", text: "Tu cuenta no tiene rol de manager." });
        } else {
          setFeedback({ kind: "error", text: "No se pudo cargar la carta." });
        }
      })
      .finally(() => setLoading(false));
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutadores del árbol ──────────────────────────────────────────────────
  function update(fn: (draft: MenuCategoryData[]) => MenuCategoryData[]): void {
    setCats((prev) => fn(structuredClone(prev)));
  }

  function addCategory(): void {
    update((d) => [...d, { id: null, name: "Nueva categoría", items: [] }]);
  }
  function renameCategory(ci: number, name: string): void {
    update((d) => { d[ci].name = name; return d; });
  }
  function deleteCategory(ci: number): void {
    if (!window.confirm("¿Borrar esta categoría y todos sus platos?")) return;
    update((d) => d.filter((_, i) => i !== ci));
  }
  function moveCategory(ci: number, dir: -1 | 1): void {
    update((d) => {
      const j = ci + dir;
      if (j < 0 || j >= d.length) return d;
      [d[ci], d[j]] = [d[j], d[ci]];
      return d;
    });
  }
  function addItem(ci: number): void {
    update((d) => { d[ci].items.push(emptyItem()); return d; });
  }
  function patchItem(ci: number, ii: number, patch: Partial<MenuItemData>): void {
    update((d) => { d[ci].items[ii] = { ...d[ci].items[ii], ...patch }; return d; });
  }
  function deleteItem(ci: number, ii: number): void {
    update((d) => { d[ci].items = d[ci].items.filter((_, i) => i !== ii); return d; });
  }
  function moveItem(ci: number, ii: number, dir: -1 | 1): void {
    update((d) => {
      const arr = d[ci].items;
      const j = ii + dir;
      if (j < 0 || j >= arr.length) return d;
      [arr[ii], arr[j]] = [arr[j], arr[ii]];
      return d;
    });
  }

  function onImage(ci: number, ii: number, file: File): void {
    if (file.size > 1_500_000) {
      setFeedback({ kind: "error", text: "La imagen es muy pesada (máx 1.5 MB)." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchItem(ci, ii, { image_url: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function handleSave(): Promise<void> {
    if (!token || saving) return;
    // Validación: nombres no vacíos.
    for (const c of cats) {
      if (!c.name.trim()) {
        setFeedback({ kind: "error", text: "Hay una categoría sin nombre." });
        return;
      }
      for (const it of c.items) {
        if (!it.name.trim()) {
          setFeedback({ kind: "error", text: `Hay un plato sin nombre en "${c.name}".` });
          return;
        }
      }
    }
    setSaving(true);
    setFeedback(null);
    try {
      const clean = cats.map((c) => ({
        id: c.id,
        name: c.name.trim(),
        items: c.items.map((it) => ({
          ...it,
          name: it.name.trim(),
          description: it.description?.trim() || null,
          badge: it.badge?.trim() || null,
          price_cents: Math.max(0, Math.round(it.price_cents || 0)),
        })),
      }));
      const res = await saveMenu(token, clean);
      setCats(res.categories.map((c) => ({ id: c.id, name: c.name, items: c.items })));
      setFeedback({ kind: "ok", text: "Carta guardada. Ya está visible en el QR de las mesas." });
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

  const input = "w-full rounded-lg border px-3 py-2 text-sm";
  const inputStyle = { borderColor: "#E2DCCC", background: "#FBF8F1" } as const;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6" style={{ background: "#F5F1E8", color: "#1A1815" }}>
      <header className="mb-5">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="mb-3 text-xs font-medium"
          style={{ color: "#6B6660" }}
        >
          ← Volver al panel
        </button>
        <h1 className="text-2xl font-black">Editar carta</h1>
        <p className="mt-1 text-xs" style={{ color: "#6B6660" }}>
          Agrega categorías y platos. Los cambios se ven al instante en el QR de
          las mesas. Carta pública:{" "}
          <a href="https://frittes2026.cl/menu" target="_blank" rel="noreferrer" className="underline">
            frittes2026.cl/menu
          </a>
        </p>
      </header>

      {loading ? (
        <p className="text-sm" style={{ color: "#6B6660" }}>Cargando carta…</p>
      ) : (
        <div className="space-y-5 pb-28">
          {cats.map((cat, ci) => (
            <section key={ci} className="rounded-2xl border p-4" style={{ borderColor: "#E2DCCC", background: "#FBF8F1" }}>
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={cat.name}
                  onChange={(e) => renameCategory(ci, e.target.value)}
                  placeholder="Nombre de la categoría"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm font-bold"
                  style={inputStyle}
                />
                <button type="button" onClick={() => moveCategory(ci, -1)} className="px-1.5 text-lg" style={{ color: "#6B6660" }}>↑</button>
                <button type="button" onClick={() => moveCategory(ci, 1)} className="px-1.5 text-lg" style={{ color: "#6B6660" }}>↓</button>
                <button type="button" onClick={() => deleteCategory(ci)} className="px-1.5 text-sm" style={{ color: "#E55934" }}>🗑</button>
              </div>

              <div className="space-y-3">
                {cat.items.map((it, ii) => (
                  <div key={ii} className="rounded-xl border p-3" style={{ borderColor: "#E2DCCC", background: "#FFFFFF" }}>
                    <div className="flex gap-3">
                      {/* Imagen */}
                      <label className="flex h-16 w-16 flex-none cursor-pointer items-center justify-center overflow-hidden rounded-lg border text-[10px] text-center" style={{ borderColor: "#E2DCCC", color: "#6B6660", background: "#F5F1E8" }}>
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>+ Foto</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(ci, ii, f); }}
                        />
                      </label>
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={it.name}
                          onChange={(e) => patchItem(ci, ii, { name: e.target.value })}
                          placeholder="Nombre del plato"
                          className={input}
                          style={inputStyle}
                        />
                        <textarea
                          value={it.description ?? ""}
                          onChange={(e) => patchItem(ci, ii, { description: e.target.value })}
                          placeholder="Descripción (opcional)"
                          rows={2}
                          className={`${input} resize-none`}
                          style={inputStyle}
                        />
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#6B6660" }}>$</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={it.price_cents || ""}
                              onChange={(e) => patchItem(ci, ii, { price_cents: Number(e.target.value) })}
                              placeholder="Precio"
                              className={`${input} pl-6`}
                              style={inputStyle}
                            />
                          </div>
                          <input
                            value={it.badge ?? ""}
                            onChange={(e) => patchItem(ci, ii, { badge: e.target.value })}
                            placeholder="Etiqueta (ej: Nuevo)"
                            maxLength={40}
                            className={`${input} flex-1`}
                            style={inputStyle}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs" style={{ color: "#6B6660" }}>
                            <input
                              type="checkbox"
                              checked={it.is_available}
                              onChange={(e) => patchItem(ci, ii, { is_available: e.target.checked })}
                            />
                            Disponible
                          </label>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => moveItem(ci, ii, -1)} className="px-1.5" style={{ color: "#6B6660" }}>↑</button>
                            <button type="button" onClick={() => moveItem(ci, ii, 1)} className="px-1.5" style={{ color: "#6B6660" }}>↓</button>
                            <button type="button" onClick={() => deleteItem(ci, ii)} className="px-1.5 text-xs" style={{ color: "#E55934" }}>Eliminar</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItem(ci)}
                  className="w-full rounded-lg border border-dashed py-2 text-sm font-semibold"
                  style={{ borderColor: "#E2DCCC", color: "#6B6660" }}
                >
                  + Agregar plato
                </button>
              </div>
            </section>
          ))}

          <button
            type="button"
            onClick={addCategory}
            className="w-full rounded-xl border border-dashed py-3 text-sm font-bold"
            style={{ borderColor: "#E2DCCC", color: "#1A1815" }}
          >
            + Agregar categoría
          </button>

          {/* Carga rápida del menú real de Frittes. Si ya hay carta, confirma
              antes de reemplazar (no se guarda hasta tocar "Guardar carta"). */}
          <button
            type="button"
            onClick={() => {
              if (
                cats.length > 0 &&
                !window.confirm(
                  "Esto reemplaza la carta del editor con el menú completo de Frittes. " +
                    "No se guarda hasta que toques 'Guardar carta'. ¿Continuar?",
                )
              ) {
                return;
              }
              setCats(structuredClone(FRITTES_MENU));
              setFeedback({ kind: "ok", text: "Menú de Frittes cargado. Revisa y dale Guardar." });
            }}
            className="w-full rounded-xl py-3 text-sm font-bold"
            style={{ background: "#FFD23F", color: "#1A1815" }}
          >
            🍟 {cats.length > 0 ? "Reemplazar con el menú completo de Frittes" : "Cargar menú completo de Frittes"}
          </button>
        </div>
      )}

      {/* Barra fija de guardar */}
      {!loading ? (
        <div className="fixed inset-x-0 bottom-0 border-t px-4 py-3" style={{ borderColor: "#E2DCCC", background: "#F5F1E8" }}>
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            {feedback ? (
              <p
                className="flex-1 truncate text-xs"
                style={{ color: feedback.kind === "ok" ? "#2D5A3F" : "#E55934" }}
              >
                {feedback.text}
              </p>
            ) : (
              <span className="flex-1 text-xs" style={{ color: "#6B6660" }}>
                {cats.length} categoría{cats.length === 1 ? "" : "s"} ·{" "}
                {cats.reduce((n, c) => n + c.items.length, 0)} platos
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="min-h-[44px] rounded-xl px-6 text-sm font-bold disabled:opacity-60"
              style={{ background: "#1A1815", color: "#FFD23F" }}
            >
              {saving ? "Guardando…" : "Guardar carta"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
