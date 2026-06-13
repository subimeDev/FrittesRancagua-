"use client";

import { useMemo, useState } from "react";

/*
 * Carta pública de Frittes con estética del PDF impreso (papel, blobs mostaza,
 * títulos negros bold, verde para las secciones veggie) + pedido fácil: el
 * cliente arma su pedido tocando los platos y lo muestra al garzón o lo manda
 * por WhatsApp al delivery.
 */

const DELIVERY_PHONE = "56935204723"; // +569 3520 4723 (del menú)

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  badge: string | null;
  image_url: string | null;
};
type MenuCategory = { id: string; name: string; position: number; items: MenuItem[] };
export type MenuView = { brand_name: string; categories: MenuCategory[] };

type Line = { item: MenuItem; categoryName: string; qty: number; note: string };

function formatCLP(pesos: number): string {
  return `$${(pesos || 0).toLocaleString("es-CL")}`;
}

function isVeggie(categoryName: string, item: MenuItem): boolean {
  return /veggie/i.test(categoryName) || (item.badge ?? "").toLowerCase() === "veggie";
}

export function MenuClient({ menu }: { menu: MenuView }): JSX.Element {
  const categories = menu.categories.filter((c) => c.items.length > 0);
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [open, setOpen] = useState(false);

  const lines = useMemo(() => Object.values(cart).filter((l) => l.qty > 0), [cart]);
  const totalCount = lines.reduce((n, l) => n + l.qty, 0);
  const totalEst = lines.reduce((n, l) => n + l.item.price_cents * l.qty, 0);

  function add(item: MenuItem, categoryName: string): void {
    setCart((prev) => {
      const cur = prev[item.id];
      return { ...prev, [item.id]: { item, categoryName, qty: (cur?.qty ?? 0) + 1, note: cur?.note ?? "" } };
    });
  }
  function setQty(id: string, qty: number): void {
    setCart((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { ...prev[id], qty } };
    });
  }
  function setNote(id: string, note: string): void {
    setCart((prev) => ({ ...prev, [id]: { ...prev[id], note } }));
  }

  function whatsappOrder(): string {
    const lineas = lines
      .map((l) => {
        const base = `• ${l.qty}× ${l.item.name}${l.note.trim() ? ` (${l.note.trim()})` : ""}`;
        return base;
      })
      .join("\n");
    const msg =
      `¡Hola Frittes! 🍟 Quiero hacer este pedido:\n\n${lineas}\n\n` +
      `Total estimado: ${formatCLP(totalEst)}\n` +
      `(el precio final depende de la proteína elegida)`;
    return `https://wa.me/${DELIVERY_PHONE}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper" style={{ background: "var(--brand-cream)" }}>
      <span className="blob-mustard-tl" aria-hidden />
      <span className="blob-mustard-br" aria-hidden />

      <main className="relative z-10 mx-auto max-w-2xl px-5 py-8 pb-32">
        {/* Encabezado tipo PDF */}
        <header className="mb-9 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/frittes-logo-trans.png" alt={menu.brand_name} className="mx-auto h-28 w-auto object-contain" />
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight text-ink">Menú</h1>
        </header>

        <div className="space-y-9">
          {categories.map((cat) => {
            const veg = /veggie/i.test(cat.name);
            const accent = veg ? "var(--brand-forest)" : "var(--brand-mustard)";
            return (
              <section key={cat.id}>
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="font-display text-2xl font-black uppercase tracking-tight text-ink">
                    {cat.name}
                  </h2>
                  {veg ? <span className="text-lg" aria-hidden>🌱</span> : null}
                </div>
                <div className="h-1 w-full rounded-full" style={{ background: accent, opacity: 0.85 }} />

                <ul className="mt-4 space-y-4">
                  {cat.items.map((it) => {
                    const decorative = it.price_cents === 0; // ej: lista de toppings
                    const veggieItem = isVeggie(cat.name, it);
                    return (
                      <li key={it.id} className="flex gap-3" style={{ opacity: it.is_available ? 1 : 0.5 }}>
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image_url} alt={it.name} className="h-20 w-20 flex-none rounded-2xl object-cover" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="font-display font-bold leading-tight text-ink">
                              {it.name}
                              {it.badge ? (
                                <span
                                  className="ml-2 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider"
                                  style={{
                                    background: veggieItem ? "var(--brand-forest)" : "var(--brand-mustard)",
                                    color: veggieItem ? "#fff" : "var(--brand-ink)",
                                  }}
                                >
                                  {it.badge}
                                </span>
                              ) : null}
                              {!it.is_available ? (
                                <span className="ml-2 text-[10px] font-semibold" style={{ color: "var(--brand-ember)" }}>
                                  No disponible
                                </span>
                              ) : null}
                            </p>
                            {!decorative ? (
                              <p className="flex-none font-mono text-sm font-black tabular-nums text-ink">
                                {formatCLP(it.price_cents)}
                              </p>
                            ) : null}
                          </div>
                          {it.description ? (
                            <p className="mt-0.5 whitespace-pre-line text-sm leading-snug text-ink-muted">
                              {it.description}
                            </p>
                          ) : null}
                          {!decorative && it.is_available ? (
                            <button
                              type="button"
                              onClick={() => add(it, cat.name)}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition active:scale-95"
                              style={{ background: "var(--brand-ink)", color: "var(--brand-mustard)" }}
                            >
                              + Agregar al pedido
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Footer tipo PDF */}
        <footer className="mt-12 border-t-2 pt-5 text-center" style={{ borderColor: "var(--brand-ink)" }}>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: "var(--brand-ink)", color: "var(--brand-mustard)" }}
          >
            ⭐ Únete al club y junta sellos
          </a>
          <p className="mt-4 font-display text-sm font-black text-ink">
            🛵 Delivery al +569 3520 4723
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            {menu.brand_name} · Precios en CLP
          </p>
        </footer>
      </main>

      {/* Barra de pedido flotante */}
      {totalCount > 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-3.5 shadow-lg"
          style={{ background: "var(--brand-ink)", color: "var(--brand-cream)" }}
        >
          <span className="flex items-center gap-2 text-sm font-bold">
            🛒 Mi pedido
            <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--brand-mustard)", color: "var(--brand-ink)" }}>
              {totalCount}
            </span>
          </span>
          <span className="text-sm font-black">{formatCLP(totalEst)}</span>
        </button>
      ) : null}

      {/* Hoja de pedido */}
      {open ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ background: "rgba(26,24,21,0.6)" }} onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl px-5 pb-6 pt-5"
            style={{ background: "var(--brand-cream)", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-ink">Mi pedido</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-muted">
                Cerrar
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">Tu pedido está vacío.</p>
            ) : (
              <div className="space-y-4">
                {lines.map((l) => (
                  <div key={l.item.id} className="rounded-2xl border p-3" style={{ borderColor: "var(--brand-line)", background: "var(--brand-cream-elev)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display font-bold text-ink">{l.item.name}</p>
                        <p className="text-xs text-ink-muted">{formatCLP(l.item.price_cents)} c/u</p>
                      </div>
                      <div className="flex flex-none items-center gap-2">
                        <button type="button" onClick={() => setQty(l.item.id, l.qty - 1)} className="grid h-7 w-7 place-items-center rounded-full font-bold" style={{ background: "var(--brand-cream-muted)", color: "var(--brand-ink)" }}>−</button>
                        <span className="w-5 text-center text-sm font-bold">{l.qty}</span>
                        <button type="button" onClick={() => setQty(l.item.id, l.qty + 1)} className="grid h-7 w-7 place-items-center rounded-full font-bold" style={{ background: "var(--brand-mustard)", color: "var(--brand-ink)" }}>+</button>
                      </div>
                    </div>
                    <input
                      value={l.note}
                      onChange={(e) => setNote(l.item.id, e.target.value)}
                      placeholder="Nota (ej: con lomito, sin tomate)"
                      className="mt-2 w-full rounded-lg border px-3 py-1.5 text-xs"
                      style={{ borderColor: "var(--brand-line)", background: "var(--brand-cream)" }}
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--brand-line)" }}>
                  <span className="text-sm text-ink-muted">Total estimado</span>
                  <span className="font-display text-lg font-black text-ink">{formatCLP(totalEst)}</span>
                </div>
                <p className="text-[11px] leading-snug text-ink-muted">
                  El total es estimado: el precio final depende de la proteína que
                  elijas. Confírmalo con el garzón o en el local.
                </p>

                <div className="space-y-2">
                  <a
                    href={whatsappOrder()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
                    style={{ background: "var(--brand-forest)", color: "#fff" }}
                  >
                    📲 Pedir por WhatsApp (delivery)
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-[44px] w-full rounded-xl border text-sm font-semibold"
                    style={{ borderColor: "var(--brand-ink)", color: "var(--brand-ink)" }}
                  >
                    🙋 Mostrar esta pantalla al garzón
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
