"use client";

import { useMemo, useState } from "react";

import type { LoyaltyCustomerDto } from "@/lib/api";
import { customers } from "@/lib/mock/customers";

type SortKey = "name" | "stamps" | "redemptions" | "member_since";
type SortDir = "asc" | "desc";
type FilterMode = "all" | "ready" | "new";

const PAGE_SIZE = 20;

export default function ClientesPage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [sortKey, setSortKey] = useState<SortKey>("member_since");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  function handleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const q = search.toLowerCase().trim();

    return customers.filter((c) => {
      if (filter === "ready" && c.stamps < c.threshold) return false;
      if (filter === "new" && now - new Date(c.member_since).getTime() > sevenDays) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [search, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "member_since") {
        av = new Date(a.member_since).getTime();
        bv = new Date(b.member_since).getTime();
      } else if (sortKey === "stamps") {
        av = a.stamps;
        bv = b.stamps;
      } else if (sortKey === "redemptions") {
        av = a.redemptions;
        bv = b.redemptions;
      } else {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      }
      const dir = sortDir === "asc" ? 1 : -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function SortIcon({ col }: { col: SortKey }): JSX.Element {
    if (sortKey !== col) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Clientes</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {filtered.length} de {customers.length} clientes
        </p>
      </div>

      {/* Busqueda + filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <svg
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nombre, teléfono o email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-line bg-cream py-2.5 pl-9 pr-4 text-sm text-ink placeholder:text-ink-muted/50 transition"
          />
        </div>

        {/* Pills de filtro rapido */}
        <div className="flex gap-2">
          {(
            [
              { key: "all", label: "Todos" },
              { key: "ready", label: "Listos para canjear" },
              { key: "new", label: "Nuevos (7 dias)" },
            ] as { key: FilterMode; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setFilter(key);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] ${
                filter === key
                  ? "bg-ink text-cream"
                  : "bg-cream-muted text-ink-muted hover:bg-line"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla — visible en md+ */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-line bg-cream-elev shadow-card">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="sticky top-0 z-10 bg-cream-elev">
                <tr className="border-b border-line">
                  <ThCell onClick={() => handleSort("name")} label="Nombre">
                    <SortIcon col="name" />
                  </ThCell>
                  <ThCell label="Telefono" />
                  <ThCell label="Email" />
                  <ThCell onClick={() => handleSort("stamps")} label="Sellos">
                    <SortIcon col="stamps" />
                  </ThCell>
                  <ThCell onClick={() => handleSort("redemptions")} label="Canjes">
                    <SortIcon col="redemptions" />
                  </ThCell>
                  <ThCell label="Tier" />
                  <ThCell onClick={() => handleSort("member_since")} label="Alta">
                    <SortIcon col="member_since" />
                  </ThCell>
                  <ThCell label="Estado" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => (
                  <CustomerRow key={c.id} customer={c} />
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-ink-muted"
                    >
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cards — visible en mobile */}
      <div className="space-y-3 md:hidden">
        {paginated.map((c) => (
          <CustomerCard key={c.id} customer={c} />
        ))}
        {paginated.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">Sin resultados</p>
        )}
      </div>

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Pagina {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-line bg-cream-elev px-4 py-2 font-medium text-ink transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-line bg-cream-elev px-4 py-2 font-medium text-ink transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThCell({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted ${
        onClick ? "cursor-pointer select-none hover:text-ink" : ""
      }`}
    >
      {label}
      {children}
    </th>
  );
}

function CustomerRow({ customer: c }: { customer: LoyaltyCustomerDto }): JSX.Element {
  const ready = c.stamps >= c.threshold;
  const pct = Math.min((c.stamps / c.threshold) * 100, 100);

  return (
    <tr className="border-b border-line last:border-0 transition hover:bg-cream-muted/20">
      <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
      <td className="px-4 py-3 text-ink-muted">{c.phone}</td>
      <td className="px-4 py-3 text-ink-muted">{c.email ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-16 overflow-hidden rounded-full"
            style={{ background: "var(--brand-cream-muted)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: "var(--brand-mustard-deep)" }}
            />
          </div>
          <span className="tabular-nums text-ink">
            {c.stamps}
            <span className="text-ink-muted">/{c.threshold}</span>
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-ink">{c.redemptions}</td>
      <td className="px-4 py-3">
        <TierBadge tier={c.tier} />
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {new Date(c.member_since).toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        {ready ? (
          <span className="rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider2 text-forest">
            Listo
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function CustomerCard({ customer: c }: { customer: LoyaltyCustomerDto }): JSX.Element {
  const ready = c.stamps >= c.threshold;
  const pct = Math.min((c.stamps / c.threshold) * 100, 100);

  return (
    <div className="rounded-2xl border border-line bg-cream-elev p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{c.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{c.phone}</p>
          {c.email && <p className="mt-0.5 text-xs text-ink-muted">{c.email}</p>}
        </div>
        <div className="flex flex-col items-end gap-1">
          <TierBadge tier={c.tier} />
          {ready && (
            <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider2 text-forest">
              Listo
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-cream-muted/60 px-2 py-2">
          <p className="font-display text-lg font-bold text-ink">{c.stamps}</p>
          <p className="text-[9px] uppercase tracking-wider2 text-ink-muted">sellos</p>
        </div>
        <div className="rounded-lg bg-cream-muted/60 px-2 py-2">
          <p className="font-display text-lg font-bold text-ink">{c.redemptions}</p>
          <p className="text-[9px] uppercase tracking-wider2 text-ink-muted">canjes</p>
        </div>
        <div className="rounded-lg bg-cream-muted/60 px-2 py-2">
          <p className="text-xs font-semibold text-ink">
            {new Date(c.member_since).toLocaleDateString("es-CL", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })}
          </p>
          <p className="text-[9px] uppercase tracking-wider2 text-ink-muted">alta</p>
        </div>
      </div>

      {/* Barra de progreso inline */}
      <div className="mt-3">
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--brand-cream-muted)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: "var(--brand-mustard-deep)" }}
          />
        </div>
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }): JSX.Element {
  const isGold = tier.toLowerCase().includes("gold");
  const isPlus = tier.toLowerCase().includes("plus");
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider2 ${
        isGold
          ? "bg-mustard text-ink"
          : isPlus
            ? "bg-forest/15 text-forest"
            : "bg-cream-muted text-ink-muted"
      }`}
    >
      {tier}
    </span>
  );
}
