"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { FrittesMark } from "@/components/frittes-mark";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "📊", exact: true },
  { href: "/admin/clientes", label: "Clientes", icon: "👥", exact: false },
  { href: "/admin/config", label: "Configuracion", icon: "⚙️", exact: false },
  { href: "/", label: "Volver al inicio", icon: "←", exact: false },
];

export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string, exact: boolean): boolean {
    if (href === "/") return false;
    return exact ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen">
      {/* Overlay mobile */}
      {open && (
        <button
          type="button"
          aria-label="Cerrar menu"
          className="fixed inset-0 z-20 bg-ink/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col transition-transform duration-300 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--brand-ink)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-cream/10 px-5 py-5">
          <FrittesMark className="h-8 w-8" fillInk="var(--brand-cream)" fillFries="var(--brand-mustard)" />
          <div className="leading-tight">
            <p className="font-display text-sm font-bold" style={{ color: "var(--brand-cream)" }}>
              FRITTES
            </p>
            <p className="font-script text-xs leading-none" style={{ color: "var(--brand-mustard)" }}>
              admin
            </p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((link) => {
            const active = isActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                  active
                    ? "text-ink"
                    : "hover:bg-cream/10"
                }`}
                style={
                  active
                    ? { background: "var(--brand-mustard)", color: "var(--brand-ink)" }
                    : { color: "rgb(251 248 241 / 0.7)" }
                }
              >
                <span className="text-base">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Contenido principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — solo en mobile */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 border-b border-line px-4 py-3 md:hidden"
          style={{ background: "var(--brand-cream-elev)" }}
        >
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-cream-muted active:scale-[0.98]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
              <path
                fillRule="evenodd"
                d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          <p className="font-display text-sm font-bold text-ink">FRITTES Admin</p>
        </div>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
