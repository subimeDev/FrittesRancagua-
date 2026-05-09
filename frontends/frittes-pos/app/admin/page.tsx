"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Staff = { id: string; email: string; name: string; role: string };

type AdminStats = {
  total_customers: number;
  total_stamps_given: number;
  total_redemptions: number;
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

type TxRow = {
  id: string;
  kind: "accrual" | "redeem";
  stamps_delta: number;
  customer_name: string;
  staff_name: string | null;
  created_at: string;
};

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

type Tab = "stats" | "customers" | "transactions" | "staff";

// ─── API helpers ─────────────────────────────────────────────────────────────

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";

function getApiUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
    .replace(/\/+$/, "");
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
      "Authorization": `Bearer ${token}`,
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

// ─── Component ───────────────────────────────────────────────────────────────

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

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    const s = JSON.parse(localStorage.getItem("frittes-pos:staff") ?? "null") as Staff | null;
    if (!t || !s) { router.replace("/login"); return; }
    setToken(t);
    setStaff(s);
  }, [router]);

  // If non-manager lands on staff tab, bounce them off
  useEffect(() => {
    if (staff && !isManager && tab === "staff") {
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

  const visibleTabs: Tab[] = isManager
    ? ["stats", "customers", "transactions", "staff"]
    : ["stats", "customers", "transactions"];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-cream px-5 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-3"
        >
          <img
            src="/frittes-logo.jpg"
            alt="Frittes Maison"
            className="h-14 w-auto object-contain"
            style={{ mixBlendMode: "multiply" }}
          />
          <div className="border-l border-line pl-3 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
              {isManager ? "Admin" : "Cajero"}
            </p>
            <p className="text-sm font-bold text-ink">{staff?.name}</p>
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

      {/* Tabs */}
      <nav className="mb-6 flex gap-1 rounded-xl bg-cream-muted p-1">
        {visibleTabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              tab === t ? "bg-white text-ink shadow-sm" : "text-black/50 hover:text-ink"
            }`}
          >
            {{ stats: "Resumen", customers: "Clientes", transactions: "Movimientos", staff: "Cajeros" }[t]}
          </button>
        ))}
      </nav>

      {tab === "stats" && <StatsTab token={token} />}
      {tab === "customers" && (
        <CustomersTab
          token={token}
          initialWithCoupon={searchParams.get("with_coupon") === "1"}
        />
      )}
      {tab === "transactions" && <TransactionsTab token={token} />}
      {tab === "staff" && isManager && (
        <StaffTab token={token} currentStaffId={staff?.id ?? ""} />
      )}
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
    setError("");
    adminRequest<AdminStats>("/loyalty/admin/stats", token)
      .then(setStats)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message || "No se pudo cargar el resumen" : "No se pudo cargar el resumen");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <TabLoading />;
  if (error) return <TabError message={error} />;
  if (!stats) return <TabError message="Sin datos" />;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Clientes registrados" value={stats.total_customers} color="text-ink" />
        <StatCard label="Sellos entregados" value={stats.total_stamps_given} color="text-forest" />
        <StatCard label="Premios canjeados" value={stats.total_redemptions} color="text-mustard-deep" />
      </div>
    </section>
  );
}

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

function StatCard({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
      <p className={`text-4xl font-bold tabular-nums ${color}`}>{value.toLocaleString("es-CL")}</p>
      <p className="mt-1 text-xs text-black/50">{label}</p>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({
  token,
  initialWithCoupon,
}: {
  token: string;
  initialWithCoupon: boolean;
}): JSX.Element {
  const [withCoupon, setWithCoupon] = useState(initialWithCoupon);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (withCoupon) params.set("with_coupon", "true");
    if (debouncedSearch) params.set("search", debouncedSearch);
    adminRequest<{ total: number; items: CustomerRow[] }>(
      `/loyalty/admin/customers?${params.toString()}`,
      token,
    )
      .then((data) => {
        setCustomers(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        setCustomers([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [token, withCoupon, debouncedSearch]);

  const couponCount = useMemo(
    () => customers.filter((c) => c.has_coupon).length,
    [customers],
  );

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none focus:ring-2 focus:ring-mustard-deep/20"
        />
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={!withCoupon}
            onClick={() => setWithCoupon(false)}
            label="Todos"
          />
          <FilterPill
            active={withCoupon}
            onClick={() => setWithCoupon(true)}
            label={`🎟️ Con cupón${withCoupon && customers.length > 0 ? ` · ${couponCount}` : ""}`}
          />
          <span className="ml-auto text-xs text-black/40">
            {loading ? "Cargando…" : `${total.toLocaleString("es-CL")} resultados`}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/40">
            {loading ? "Cargando…" : withCoupon ? "Ningún cliente con cupón disponible." : "Sin resultados."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
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
                    {c.has_coupon ? (
                      <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">
                        Cupón
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-black/40">{c.phone}</p>
                </div>
                <div className="flex-none text-right">
                  <p className="font-bold tabular-nums text-ink">
                    {c.stamps}
                    <span className="text-sm font-normal text-black/40">/{c.threshold}</span>
                  </p>
                  <p className="text-[10px] text-black/40">{c.redemptions} canjes</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
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

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ token }: { token: string }): JSX.Element {
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    adminRequest<TxRow[]>("/loyalty/admin/transactions?limit=60", token)
      .then(setTransactions)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message || "No se pudieron cargar los movimientos" : "No se pudieron cargar los movimientos");
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
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-full text-base ${
                tx.kind === "accrual" ? "bg-forest/10" : "bg-mustard/30"
              }`}>
                {tx.kind === "accrual" ? "⭐" : "🎁"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{tx.customer_name}</p>
                <p className="text-xs text-black/40">
                  {tx.staff_name ?? "—"} · {new Date(tx.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <span className={`text-sm font-bold tabular-nums ${tx.kind === "accrual" ? "text-forest" : "text-mustard-deep"}`}>
                {tx.kind === "accrual" ? `+${tx.stamps_delta}` : `−${Math.abs(tx.stamps_delta)}`}
              </span>
            </div>
          ))}
        </div>
      )}
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
    setError("");
    adminRequest<StaffRow[]>("/loyalty/admin/staff", token)
      .then(setStaffList)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message || "No se pudo cargar el equipo" : "No se pudo cargar el equipo");
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
            {s.id !== currentStaffId && (
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
                {toggling === s.id ? "..." : s.is_active ? "Desactivar" : "Activar"}
              </button>
            )}
            {s.id === currentStaffId && (
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
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none"
          />
          <input
            required
            type="email"
            placeholder="correo@frittes.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none"
          />
          <input
            required
            type="password"
            placeholder="Contraseña"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-cream px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-mustard-deep focus:outline-none"
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
              {loading ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
