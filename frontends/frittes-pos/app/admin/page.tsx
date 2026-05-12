"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Staff = { id: string; email: string; name: string; role: string };

type AdminStats = {
  total_customers: number;
  total_stamps_given: number;
  total_redemptions: number;
  customers_with_coupon?: number;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  stamps: number;
  threshold: number;
  lifetime_stamps: number;
  redemptions: number;
  has_coupon: boolean;
  member_since: string;
};

type TopCustomer = CustomerRow & { rank: number };

type TxRow = {
  id: string;
  kind: "accrual" | "redeem";
  stamps_delta: number;
  customer_name: string;
  staff_name: string | null;
  created_at: string;
  is_manual: boolean;
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type ProgramConfig = {
  threshold: number;
  reward_name: string;
  tier_name: string;
};

type Tab = "stats" | "top" | "customers" | "transactions" | "config" | "staff";

// ─── API ─────────────────────────────────────────────────────────────────────

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";

function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/+$/, "");
}

async function adminRequest<T>(
  path: string,
  token: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Restaurant-Id": RESTAURANT_ID,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let payload: unknown;
    try { payload = await res.json(); } catch { payload = undefined; }
    const code =
      typeof payload === "object" && payload && "code" in payload
        ? String((payload as { code?: unknown }).code ?? `http_${res.status}`)
        : `http_${res.status}`;
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "Error")
        : "Error";
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function TabLoading(): JSX.Element {
  return (
    <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-black/40">
      Cargando…
    </p>
  );
}

function TabError({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm font-semibold text-red-700">{message}</p>
    </div>
  );
}

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? "bg-ink text-white" : "bg-cream-muted text-black/60 hover:bg-cream-muted/70"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-cream">
          <p className="text-sm text-black/40">Cargando panel...</p>
        </main>
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "stats";
  const [tab, setTab] = useState<Tab>(initialTab);

  const isManager = staff?.role === "manager";

  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    const s = JSON.parse(localStorage.getItem("frittes-pos:staff") ?? "null") as Staff | null;
    if (!t || !s) { router.replace("/login"); return; }
    setToken(t);
    setStaff(s);
  }, [router]);

  useEffect(() => {
    if (staff && !isManager && (tab === "staff" || tab === "config")) {
      setTab("stats");
    }
  }, [staff, isManager, tab]);

  if (!token || !staff) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-black/40">Cargando panel...</p>
      </main>
    );
  }

  const visibleTabs: { key: Tab; label: string }[] = [
    { key: "stats", label: "Resumen" },
    { key: "top", label: "Top" },
    { key: "customers", label: "Clientes" },
    { key: "transactions", label: "Movimientos" },
    ...(isManager ? [{ key: "config" as Tab, label: "Config" }] : []),
    ...(isManager ? [{ key: "staff" as Tab, label: "Cajeros" }] : []),
  ];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-cream px-4 py-6">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between">
        <button type="button" onClick={() => router.push("/")} className="flex items-center gap-3">
          <img
            src="/frittes-logo.png"
            alt="Frittes Maison"
            className="h-12 w-auto object-contain"
            
          />
          <div className="border-l border-line pl-3 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
              {isManager ? "Admin" : "Cajero"}
            </p>
            <p className="text-sm font-bold text-ink">{staff.name}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-black/70 hover:bg-gray-50"
        >
          ← POS
        </button>
      </header>

      {/* Tabs – scrollable on mobile */}
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-cream-muted p-1 scrollbar-none">
        {visibleTabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-none rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition ${
              tab === key ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "stats" && <StatsTab token={token} />}
      {tab === "top" && <TopTab token={token} />}
      {tab === "customers" && (
        <CustomersTab
          token={token}
          isManager={isManager}
          initialWithCoupon={searchParams.get("with_coupon") === "1"}
        />
      )}
      {tab === "transactions" && <TransactionsTab token={token} />}
      {tab === "config" && isManager && <ConfigTab token={token} />}
      {tab === "staff" && isManager && <StaffTab token={token} currentStaffId={staff.id} />}
    </main>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ token }: { token: string }): JSX.Element {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    adminRequest<AdminStats>("/loyalty/admin/stats", token)
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message || "No se pudo cargar el resumen" : "Error");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <TabLoading />;
  if (error) return <TabError message={error} />;
  if (!stats) return <TabError message="Sin datos" />;

  return (
    <section className="space-y-4">
      <div className={`grid gap-3 ${stats.customers_with_coupon !== undefined ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
        <StatCard label="Clientes" value={stats.total_customers} icon="👥" color="text-ink" />
        <StatCard label="Sellos dados" value={stats.total_stamps_given} icon="⭐" color="text-forest" />
        <StatCard label="Premios canjeados" value={stats.total_redemptions} icon="🎁" color="text-amber-600" />
        {stats.customers_with_coupon !== undefined && (
          <StatCard label="Con cupón listo" value={stats.customers_with_coupon} icon="🎟️" color="text-mustard-deep" />
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 text-center shadow-sm">
      <p className="text-2xl">{icon}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("es-CL")}</p>
      <p className="mt-0.5 text-[11px] text-black/50">{label}</p>
    </div>
  );
}

// ─── Top Tab ──────────────────────────────────────────────────────────────────

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function TopTab({ token }: { token: string }): JSX.Element {
  const [tops, setTops] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminRequest<TopCustomer[]>("/loyalty/admin/top-customers?limit=20", token)
      .then(setTops)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el ranking");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <TabLoading />;
  if (error) return <TabError message={error} />;
  if (tops.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="text-4xl">🏆</p>
        <p className="mt-2 text-sm text-black/40">Aún no hay clientes registrados.</p>
      </div>
    );
  }

  const podium = tops.slice(0, 3);
  const rest = tops.slice(3);

  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-black/40">
        Ranking por sellos totales
      </p>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-3">
        {podium.map((c) => (
          <div
            key={c.id}
            className={`relative flex flex-col items-center rounded-2xl border p-4 text-center shadow-sm ${
              c.rank === 1
                ? "border-amber-300 bg-amber-50"
                : c.rank === 2
                ? "border-slate-300 bg-slate-50"
                : "border-orange-200 bg-orange-50"
            }`}
          >
            <span className="text-3xl">{MEDALS[c.rank]}</span>
            <div
              className={`mt-2 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${
                c.rank === 1 ? "bg-amber-400" : c.rank === 2 ? "bg-slate-400" : "bg-orange-400"
              }`}
            >
              {c.name.charAt(0).toUpperCase()}
            </div>
            <p className="mt-1.5 w-full truncate text-xs font-bold text-ink">{c.name.split(" ")[0]}</p>
            <p className="text-lg font-bold tabular-nums text-ink">{c.lifetime_stamps}</p>
            <p className="text-[10px] text-black/40">sellos totales</p>
            {c.has_coupon && (
              <span className="mt-1 rounded-full bg-forest px-2 py-0.5 text-[9px] font-bold uppercase text-cream">
                Cupón
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rest of the list */}
      {rest.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          {rest.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="w-6 flex-none text-center text-xs font-bold text-black/40">
                {c.rank}
              </span>
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-cream-muted text-sm font-bold text-ink">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-black/40">{c.redemptions} canjes · miembro desde {new Date(c.member_since).toLocaleDateString("es-CL", { month: "short", year: "numeric" })}</p>
              </div>
              <div className="flex-none text-right">
                <p className="font-bold tabular-nums text-ink">{c.lifetime_stamps} <span className="text-xs font-normal text-black/40">total</span></p>
                <p className="text-xs tabular-nums text-black/40">{c.stamps}/{c.threshold} actuales</p>
              </div>
              {c.has_coupon && (
                <span className="flex-none rounded-full bg-mustard px-2 py-0.5 text-[10px] font-bold text-ink">
                  🎟️
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({
  token,
  isManager,
  initialWithCoupon,
}: {
  token: string;
  isManager: boolean;
  initialWithCoupon: boolean;
}): JSX.Element {
  const [withCoupon, setWithCoupon] = useState(initialWithCoupon);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (withCoupon) params.set("with_coupon", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    adminRequest<{ total: number; items: CustomerRow[] }>(
      `/loyalty/admin/customers?${params.toString()}`,
      token,
    )
      .then((data) => { setCustomers(data.items); setTotal(data.total); })
      .catch(() => { setCustomers([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [token, withCoupon, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem(c: CustomerRow): Promise<void> {
    setActionLoading(c.id);
    try {
      const res = await adminRequest<{ new_balance: number; redemptions: number }>(
        `/loyalty/admin/customers/${c.id}/redeem`,
        token,
        { method: "POST" },
      );
      setActionMsg({ id: c.id, text: `Premio canjeado ✓ — saldo: ${res.new_balance} sellos`, ok: true });
      load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al canjear";
      setActionMsg({ id: c.id, text: msg, ok: false });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAdjust(c: CustomerRow, delta: number): Promise<void> {
    setActionLoading(`${c.id}_adj`);
    try {
      const res = await adminRequest<{ new_balance: number }>(
        `/loyalty/admin/customers/${c.id}/adjust-stamps`,
        token,
        { method: "POST", body: { delta } },
      );
      setActionMsg({ id: c.id, text: `Saldo actualizado → ${res.new_balance} sellos`, ok: true });
      load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al ajustar";
      setActionMsg({ id: c.id, text: msg, ok: false });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={!withCoupon} onClick={() => setWithCoupon(false)} label="Todos" />
          <FilterPill active={withCoupon} onClick={() => setWithCoupon(true)} label="🎟️ Con cupón" />
          <span className="ml-auto text-xs text-black/40">
            {loading ? "Cargando…" : `${total.toLocaleString("es-CL")} resultados`}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">
            {loading ? "Cargando…" : "Sin resultados."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => {
              const isExpanded = expandedId === c.id;
              const isActing = actionLoading === c.id || actionLoading === `${c.id}_adj`;
              const msg = actionMsg?.id === c.id ? actionMsg : null;
              const pct = Math.min(100, Math.round((c.stamps / c.threshold) * 100));

              return (
                <li key={c.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : c.id);
                      setActionMsg(null);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-cream/60 transition"
                  >
                    <div
                      className={`flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-bold ${
                        c.has_coupon ? "bg-mustard text-ink" : "bg-cream-muted text-ink"
                      }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-ink">{c.name}</p>
                        {c.has_coupon && (
                          <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">
                            Cupón
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-muted">
                          <div
                            className="h-full rounded-full bg-mustard transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-black/40">
                          {c.stamps}/{c.threshold}
                        </span>
                      </div>
                    </div>
                    <div className="flex-none text-right">
                      <p className="text-[10px] text-black/40">{c.redemptions} canjes</p>
                      <p className="text-[10px] text-black/30 tabular-nums">{c.lifetime_stamps} total</p>
                    </div>
                    <span className={`flex-none text-black/30 text-sm transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                  </button>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="border-t border-line bg-cream/50 px-4 py-4 space-y-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-black/50">
                        <span>📧 {c.phone}</span>
                        <span>📅 Desde {new Date(c.member_since).toLocaleDateString("es-CL", { dateStyle: "medium" })}</span>
                        <span>⭐ {c.lifetime_stamps} sellos totales</span>
                      </div>

                      {isManager && (
                        <div className="flex flex-wrap gap-2">
                          {c.has_coupon && (
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => { void handleRedeem(c); }}
                              className="flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 active:scale-95 transition"
                            >
                              🎁 Canjear premio
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => { void handleAdjust(c, 1); }}
                            className="rounded-xl bg-mustard px-3 py-2 text-sm font-bold text-ink shadow-sm disabled:opacity-60 active:scale-95 transition"
                          >
                            +1 sello
                          </button>
                          <button
                            type="button"
                            disabled={isActing || c.stamps === 0}
                            onClick={() => { void handleAdjust(c, -1); }}
                            className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm disabled:opacity-40 active:scale-95 transition"
                          >
                            −1 sello
                          </button>
                          <button
                            type="button"
                            disabled={isActing || c.stamps === 0}
                            onClick={() => {
                              const leftover = c.stamps % c.threshold;
                              const toRemove = c.stamps - leftover;
                              if (toRemove > 0) void handleAdjust(c, -toRemove);
                            }}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40 active:scale-95 transition"
                          >
                            Anular cupón
                          </button>
                          {isActing && (
                            <span className="flex items-center gap-1 text-xs text-black/40">
                              <span className="animate-pulse">⏳</span> Procesando…
                            </span>
                          )}
                        </div>
                      )}

                      {msg && (
                        <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                          {msg.text}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ token }: { token: string }): JSX.Element {
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminRequest<TxRow[]>("/loyalty/admin/transactions?limit=60", token)
      .then(setTransactions)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "No se pudieron cargar los movimientos");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <TabLoading />;
  if (error) return <TabError message={error} />;

  return (
    <section className="space-y-2">
      <p className="text-xs text-black/40">Últimos {transactions.length} movimientos</p>
      {transactions.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-black/40">
          Sin transacciones aún.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          {transactions.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span
                className={`grid h-9 w-9 flex-none place-items-center rounded-full text-base ${
                  tx.kind === "accrual" ? "bg-forest/10" : "bg-mustard/30"
                }`}
              >
                {tx.kind === "accrual" ? "⭐" : "🎁"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold text-ink">{tx.customer_name}</p>
                  {tx.is_manual && (
                    <span className="rounded-full bg-cream-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-black/40">
                      manual
                    </span>
                  )}
                </div>
                <p className="text-xs text-black/40">
                  {tx.staff_name ?? "—"} · {new Date(tx.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <span
                className={`text-sm font-bold tabular-nums ${tx.kind === "accrual" ? "text-forest" : "text-amber-600"}`}
              >
                {tx.stamps_delta > 0 ? `+${tx.stamps_delta}` : `${tx.stamps_delta}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Config Tab ───────────────────────────────────────────────────────────────

function ConfigTab({ token }: { token: string }): JSX.Element {
  const [config, setConfig] = useState<ProgramConfig>({
    threshold: 10,
    reward_name: "Papas fritas gratis",
    tier_name: "Maisonero",
  });
  const [draft, setDraft] = useState<ProgramConfig>(config);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminRequest<ProgramConfig>("/loyalty/admin/config", token)
      .then((cfg) => { setConfig(cfg); setDraft(cfg); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError("");
    try {
      const updated = await adminRequest<ProgramConfig>("/loyalty/admin/config", token, {
        method: "PATCH",
        body: draft,
      });
      setConfig(updated);
      setDraft(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    draft.threshold !== config.threshold ||
    draft.reward_name !== config.reward_name ||
    draft.tier_name !== config.tier_name;

  if (loading) return <TabLoading />;

  return (
    <section className="space-y-4">
      {/* Live preview */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/40">
          Vista previa del pase
        </p>
        <div className="mx-auto max-w-xs overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
          <div className="px-5 py-4" style={{ background: "linear-gradient(135deg,#FFD23F,#E8B82E)" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-ink/60">Frittes Maison</p>
            <p className="mt-0.5 text-xl font-black text-ink">{draft.tier_name || "Maisonero"}</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between text-xs text-white/60">
              <span>Premio</span>
              <span className="font-semibold text-white">{draft.reward_name || "—"}</span>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-white/60">Progreso</span>
                <span className="font-semibold text-mustard">0/{draft.threshold} sellos</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-0 rounded-full bg-mustard" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-5">
        <p className="text-sm font-bold text-ink">Configuración del programa</p>

        {/* Threshold */}
        <label className="block space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">Umbral de sellos</span>
            <span className="rounded-xl bg-mustard px-3 py-1 text-sm font-black text-ink tabular-nums">
              {draft.threshold} sellos
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={draft.threshold}
            onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })}
            className="w-full accent-ink"
          />
          <p className="text-xs text-black/40">
            Los clientes necesitarán {draft.threshold} sellos para obtener su premio.
            Actualiza el umbral de todos los clientes existentes.
          </p>
        </label>

        {/* Reward name */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Nombre del premio</span>
          <input
            type="text"
            value={draft.reward_name}
            onChange={(e) => setDraft({ ...draft, reward_name: e.target.value })}
            maxLength={100}
            placeholder="Ej: Papas fritas gratis"
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
          />
          <p className="text-xs text-black/40">Lo que recibe el cliente al canjear su cupón.</p>
        </label>

        {/* Tier name */}
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-ink">Nombre del nivel</span>
          <input
            type="text"
            value={draft.tier_name}
            onChange={(e) => setDraft({ ...draft, tier_name: e.target.value })}
            maxLength={60}
            placeholder="Ej: Maisonero"
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
          />
          <p className="text-xs text-black/40">Aparece en el pase digital del cliente.</p>
        </label>

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          {isDirty && (
            <button
              type="button"
              onClick={() => setDraft(config)}
              className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-black/60 hover:bg-cream"
            >
              Descartar
            </button>
          )}
          <button
            type="button"
            disabled={saving || !isDirty}
            onClick={() => { void handleSave(); }}
            className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 active:scale-[0.98] transition"
          >
            {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar cambios"}
          </button>
        </div>

        {saved && (
          <p className="rounded-xl bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700">
            ✓ Configuración actualizada. El umbral de todos los clientes fue actualizado.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Staff Tab ────────────────────────────────────────────────────────────────

function StaffTab({
  token,
  currentStaffId,
}: {
  token: string;
  currentStaffId: string;
}): JSX.Element {
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    adminRequest<StaffRow[]>("/loyalty/admin/staff", token)
      .then(setStaffList)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "No se pudo cargar el equipo");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggleActive(s: StaffRow): Promise<void> {
    setToggling(s.id);
    try {
      await adminRequest(`/loyalty/admin/staff/${s.id}`, token, {
        method: "PATCH",
        body: { is_active: !s.is_active },
      });
      refresh();
    } finally {
      setToggling(null);
    }
  }

  if (loading) return <TabLoading />;
  if (error) return <TabError message={error} />;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-black/40">{staffList.length} usuarios</p>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white"
        >
          + Nuevo cajero
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {staffList.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <div
              className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-bold ${
                s.role === "manager" ? "bg-mustard text-ink" : "bg-cream-muted text-ink"
              }`}
            >
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{s.name}</p>
              <p className="text-xs text-black/40">
                {s.email} · {s.role === "manager" ? "Admin" : "Cajero"}
              </p>
            </div>
            {s.id !== currentStaffId ? (
              <button
                type="button"
                disabled={toggling === s.id}
                onClick={() => { void toggleActive(s); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                  s.is_active
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-700 hover:bg-green-100"
                }`}
              >
                {toggling === s.id ? "…" : s.is_active ? "Desactivar" : "Activar"}
              </button>
            ) : (
              <span className="rounded-lg bg-cream-muted px-3 py-1.5 text-xs text-black/40">Tú</span>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <CreateStaffModal
          token={token}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); refresh(); }}
        />
      )}
    </section>
  );
}

// ─── Create Staff Modal ───────────────────────────────────────────────────────

function CreateStaffModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"cashier" | "manager">("cashier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    setError("");
    try {
      await adminRequest("/loyalty/admin/staff", token, {
        method: "POST",
        body: { name, email, password, role },
      });
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code === "duplicate_email"
            ? "Ese email ya está registrado."
            : err.message
          : "Error al crear usuario.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <h3 className="mb-4 font-bold text-ink">Nuevo cajero / admin</h3>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-3">
          <input
            required
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none"
          />
          <input
            required
            type="email"
            placeholder="correo@frittes.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none"
          />
          <input
            required
            type="password"
            placeholder="Contraseña"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-black/30 focus:border-mustard-deep focus:outline-none"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "cashier" | "manager")}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink focus:border-mustard-deep focus:outline-none"
          >
            <option value="cashier">Cajero</option>
            <option value="manager">Administrador</option>
          </select>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-black/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
