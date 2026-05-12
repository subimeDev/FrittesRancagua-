import Link from "next/link";

import { customers } from "@/lib/mock/customers";

export default function AdminDashboard(): JSX.Element {
  const totalClientes = customers.length;
  const sellsHoy = 24; // mock — reemplazar con endpoint cuando este listo
  const canjesHoy = 8;
  const listosParaCanjear = customers.filter((c) => c.stamps >= c.threshold).length;

  const ultimosRegistros = [...customers]
    .sort((a, b) => new Date(b.member_since).getTime() - new Date(a.member_since).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">Resumen del programa Club Frittes</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="👥" value={totalClientes} label="Total clientes" />
        <StatCard icon="🏷️" value={sellsHoy} label="Sellos entregados hoy" />
        <StatCard icon="🎁" value={canjesHoy} label="Canjes realizados" />
        <StatCard icon="⭐" value={listosParaCanjear} label="Listos para canjear" />
      </div>

      {/* Ultimos registros */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Ultimos clientes registrados</h2>
          <Link
            href="/admin/clientes"
            className="text-xs font-semibold text-mustard-deep underline-offset-2 hover:underline"
          >
            Ver todos →
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-cream-elev shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line bg-cream-muted/40">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">
                    Nombre
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted sm:table-cell">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">
                    Sellos
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted sm:table-cell">
                    Fecha de alta
                  </th>
                </tr>
              </thead>
              <tbody>
                {ultimosRegistros.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-0 hover:bg-cream-muted/20 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
                    <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">{c.phone}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink">{c.stamps}</span>
                      <span className="text-ink-muted">/{c.threshold}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-muted sm:table-cell">
                      {new Date(c.member_since).toLocaleDateString("es-CL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number;
  label: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-line bg-cream-elev p-4 shadow-card">
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-xs font-medium text-ink-muted">{label}</p>
    </div>
  );
}
