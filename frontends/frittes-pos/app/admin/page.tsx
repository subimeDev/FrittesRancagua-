"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
  lifetime_stamps: number;
  redemptions: number;
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
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("frittes-pos:session");
    const s = JSON.parse(localStorage.getItem("frittes-pos:staff") ?? "null") as Staff | null;
    if (!t || !s) { router.replace("/login"); return; }
    if (s.role !== "manager") { router.replace("/"); return; }
    setToken(t);
    setStaff(s);
  }, [router]);

  const loadStats = useCallback(async (t: string) => {
    const data = await adminRequest<AdminStats>("/loyalty/admin/stats", t);
    setStats(data);
  }, []);

  const loadCustomers = useCallback(async (t: string) => {
    const data = await adminRequest<{ total: number; items: CustomerRow[] }>("/loyalty/admin/customers?limit=100", t);
    setCustomers(data.items);
  }, []);

  const loadTransactions = useCallback(async (t: string) => {
    const data = await adminRequest<TxRow[]>("/loyalty/admin/transactions?limit=60", t);
    setTransactions(data);
  }, []);

  const loadStaff = useCallback(async (t: string) => {
    const data = await adminRequest<StaffRow[]>("/loyalty/admin/staff", t);
    setStaffList(data);
  }, []);

  // Load all data once authenticated
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([loadStats(token), loadCustomers(token), loadTransactions(token), loadStaff(token)])
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Error al cargar datos");
      })
      .finally(() => setLoading(false));
  }, [token, loadStats, loadCustomers, loadTransactions, loadStaff]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <p className="text-sm text-black/40">Cargando panel...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-cream">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="rounded-xl bg-ink px-6 py-2.5 text-sm font-semibold text-white"
          >
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-cream px-5 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-bold text-ink">Panel de Administración</p>
          <p className="text-xs text-black/50">{staff?.name}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-black/70 hover:bg-gray-50"
        >
          ← POS
        </button>
      </header>

      {/* Tabs */}
      <nav className="mb-6 flex gap-1 rounded-xl bg-cream-muted p-1">
        {(["stats", "customers", "transactions", "staff"] as Tab[]).map((t) => (
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

      {tab === "stats" && stats && <StatsTab stats={stats} />}
      {tab === "customers" && <CustomersTab customers={customers} />}
      {tab === "transactions" && <TransactionsTab transactions={transactions} />}
      {tab === "staff" && token && (
        <StaffTab
          staffList={staffList}
          token={token}
          currentStaffId={staff?.id ?? ""}
          onRefresh={() => { void loadStaff(token).catch(() => null); }}
        />
      )}
    </main>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({ stats }: { stats: AdminStats }): JSX.Element {
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center">
      <p className={`text-4xl font-bold tabular-nums ${color}`}>{value.toLocaleString("es-CL")}</p>
      <p className="mt-1 text-xs text-black/50">{label}</p>
    </div>
  );
}

// ─── Customers Tab ────────────────────────────────────────────────────────────

function CustomersTab({ customers }: { customers: CustomerRow[] }): JSX.Element {
  return (
    <section className="space-y-3">
      <p className="text-xs text-black/40">{customers.length} clientes</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {customers.length === 0 ? (
          <p className="p-6 text-center text-sm text-black/40">Sin clientes aún.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-cream-muted text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-black/50">Nombre</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-black/50">Email</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-black/50">Sellos</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-black/50">Canjes</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "" : "bg-cream/40"}>
                  <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 text-black/50">{c.phone}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-forest">{c.stamps}</td>
                  <td className="px-4 py-2.5 text-right text-black/50">{c.redemptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ transactions }: { transactions: TxRow[] }): JSX.Element {
  return (
    <section className="space-y-2">
      <p className="text-xs text-black/40">Últimos {transactions.length} movimientos</p>
      {transactions.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-black/40">
          Sin transacciones aún.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {transactions.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="text-xl">
                {tx.kind === "accrual" ? "⭐" : "🎁"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{tx.customer_name}</p>
                <p className="text-xs text-black/40">
                  {tx.staff_name ?? "—"} · {new Date(tx.created_at).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <span className={`text-sm font-bold ${tx.kind === "accrual" ? "text-forest" : "text-mustard-deep"}`}>
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
  staffList,
  token,
  currentStaffId,
  onRefresh,
}: {
  staffList: StaffRow[];
  token: string;
  currentStaffId: string;
  onRefresh: () => void;
}): JSX.Element {
  const [showForm, setShowForm] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function toggleActive(s: StaffRow): Promise<void> {
    setToggling(s.id);
    try {
      await adminRequest(`/loyalty/admin/staff/${s.id}`, token, {
        method: "PATCH",
        body: { is_active: !s.is_active },
      });
      onRefresh();
    } finally {
      setToggling(null);
    }
  }

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

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
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
          onCreated={() => { setShowForm(false); onRefresh(); }}
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
