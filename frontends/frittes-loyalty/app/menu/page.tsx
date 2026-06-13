import type { Metadata } from "next";

import { branding } from "@/lib/branding";

/*
 * Carta pública de Frittes (lo que ve el cliente al escanear el QR de la mesa).
 * Server component: hace fetch directo al backend, sin estado. Precios en pesos
 * CLP directos.
 */

export const metadata: Metadata = {
  title: "Carta — Frittes Maison",
  description: "Nuestra carta. Papas, hot dogs, sándwiches y más.",
};

// La carta puede cambiar en cualquier momento desde el panel → sin cache.
export const dynamic = "force-dynamic";

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
type MenuView = { brand_name: string; categories: MenuCategory[] };

function formatCLP(pesos: number): string {
  return `$${(pesos || 0).toLocaleString("es-CL")}`;
}

async function fetchMenu(): Promise<MenuView | null> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";
  if (!base) return null;
  try {
    const res = await fetch(`${base}/loyalty/public/menu`, {
      headers: { "X-Restaurant-Id": restaurantId },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as MenuView;
  } catch {
    return null;
  }
}

export default async function MenuPage(): Promise<JSX.Element> {
  const menu = await fetchMenu();
  const categories = (menu?.categories ?? []).filter((c) => c.items.length > 0);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-8" style={{ background: "var(--brand-cream)", color: "var(--brand-ink)" }}>
      {/* Encabezado de marca */}
      <header className="mb-8 text-center">
        <img
          src="/frittes-logo-trans.png"
          alt={menu?.brand_name ?? "Frittes Maison"}
          className="mx-auto h-28 w-auto object-contain"
        />
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--brand-ink-muted)" }}>
          Carta digital
        </p>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-2xl border px-5 py-10 text-center" style={{ borderColor: "var(--brand-line)" }}>
          <p className="text-sm" style={{ color: "var(--brand-ink-muted)" }}>
            La carta se está actualizando. Vuelve en un momento 🍟
          </p>
        </div>
      ) : (
        <div className="space-y-9">
          {categories.map((cat) => (
            <section key={cat.id}>
              <h2
                className="mb-4 border-b-2 pb-1.5 text-lg font-black uppercase tracking-wide"
                style={{ borderColor: "var(--brand-mustard)", color: "var(--brand-ink)" }}
              >
                {cat.name}
              </h2>
              <ul className="space-y-4">
                {cat.items.map((it) => (
                  <li
                    key={it.id}
                    className="flex gap-3"
                    style={{ opacity: it.is_available ? 1 : 0.5 }}
                  >
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image_url}
                        alt={it.name}
                        className="h-20 w-20 flex-none rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-bold leading-tight" style={{ color: "var(--brand-ink)" }}>
                          {it.name}
                          {it.badge ? (
                            <span
                              className="ml-2 rounded-full px-2 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider"
                              style={{ background: "var(--brand-mustard)", color: "var(--brand-ink)" }}
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
                        <p className="flex-none font-mono text-sm font-bold tabular-nums" style={{ color: "var(--brand-ink)" }}>
                          {formatCLP(it.price_cents)}
                        </p>
                      </div>
                      {it.description ? (
                        <p className="mt-0.5 whitespace-pre-line text-sm leading-snug" style={{ color: "var(--brand-ink-muted)" }}>
                          {it.description}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-12 border-t pt-5 text-center" style={{ borderColor: "var(--brand-line)" }}>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold"
          style={{ background: "var(--brand-ink)", color: "var(--brand-mustard)" }}
        >
          ⭐ Únete al club y junta sellos
        </a>
        <p className="mt-4 text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--brand-ink-muted)" }}>
          {menu?.brand_name ?? branding.name} · Precios en CLP
        </p>
      </footer>
    </main>
  );
}
