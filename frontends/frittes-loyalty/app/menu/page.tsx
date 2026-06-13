import type { Metadata } from "next";

import { MenuClient, type MenuView } from "@/components/menu-client";

/*
 * Carta pública de Frittes (lo que ve el cliente al escanear el QR de la mesa).
 * Server component: hace fetch y delega el render interactivo (diseño PDF +
 * pedido) a MenuClient.
 */

export const metadata: Metadata = {
  title: "Carta — Frittes Maison",
  description: "Nuestra carta. Papas, hot dogs, sándwiches y más.",
};

// La carta cambia en cualquier momento desde el panel → sin cache.
export const dynamic = "force-dynamic";

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

  if (!menu || menu.categories.every((c) => c.items.length === 0)) {
    return (
      <main className="mx-auto grid min-h-screen max-w-md place-items-center px-6" style={{ background: "var(--brand-cream)" }}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/frittes-logo-trans.png" alt="Frittes Maison" className="mx-auto h-24 w-auto object-contain" />
          <p className="mt-4 text-sm" style={{ color: "var(--brand-ink-muted)" }}>
            La carta se está actualizando. Vuelve en un momento 🍟
          </p>
        </div>
      </main>
    );
  }

  return <MenuClient menu={menu} />;
}
