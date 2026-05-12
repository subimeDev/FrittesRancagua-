"use client";

import { useEffect, useState } from "react";

import { toast } from "@/components/toast";
import { FrittesMark } from "@/components/frittes-mark";

type Config = {
  rewardName: string;
  stampsRequired: number;
  rewardDescription: string;
  programActive: boolean;
  minAmount: number;
  maxStampsPerDay: number;
  stampValidityMonths: number;
  brandColor: string;
};

const DEFAULT_CONFIG: Config = {
  rewardName: "Papas L gratis",
  stampsRequired: 10,
  rewardDescription: "Porcion de papas fritas tamano L",
  programActive: true,
  minAmount: 5000,
  maxStampsPerDay: 3,
  stampValidityMonths: 12,
  brandColor: "#FFD23F",
};

const STORAGE_KEY = "frittes-admin:config";

const COLOR_PRESETS = [
  { label: "Mostaza", value: "#FFD23F" },
  { label: "Bosque", value: "#2D5A3F" },
  { label: "Ember", value: "#E55934" },
  { label: "Azul cielo", value: "#4EA8DE" },
  { label: "Purpura", value: "#7B5EA7" },
  { label: "Negro", value: "#1A1815" },
];

export default function ConfigPage(): JSX.Element {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConfig(JSON.parse(raw) as Config);
    } catch {
      /* localStorage no disponible */
    }
  }, []);

  function update<K extends keyof Config>(key: K, value: Config[K]): void {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave(): void {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      toast.success("Configuracion guardada ✓");
    } catch {
      toast.error("No se pudo guardar. Revisa los permisos del navegador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Configuracion</h1>
        <p className="mt-1 text-sm text-ink-muted">Ajusta el programa de puntos y la identidad visual</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Formulario */}
        <div className="space-y-6">
          {/* Recompensa actual */}
          <fieldset className="rounded-2xl border border-line bg-cream-elev p-5 shadow-card">
            <legend className="mb-4 font-display text-base font-semibold text-ink">
              Recompensa actual
            </legend>
            <div className="space-y-4">
              <Field label="Nombre del premio">
                <input
                  type="text"
                  required
                  value={config.rewardName}
                  onChange={(e) => update("rewardName", e.target.value)}
                  className="input-base"
                  placeholder="Papas L gratis"
                />
              </Field>
              <Field label="Sellos necesarios">
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={config.stampsRequired}
                  onChange={(e) => update("stampsRequired", Number(e.target.value))}
                  className="input-base w-32"
                />
              </Field>
              <Field label="Descripcion corta">
                <textarea
                  rows={2}
                  value={config.rewardDescription}
                  onChange={(e) => update("rewardDescription", e.target.value)}
                  className="input-base resize-none"
                  placeholder="Porcion de papas fritas tamano L"
                />
              </Field>
              <div className="flex items-center justify-between rounded-xl border border-line bg-cream px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Programa activo</p>
                  <p className="text-xs text-ink-muted">
                    {config.programActive ? "El club acepta nuevos sellos" : "Acumulacion pausada"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.programActive}
                  onClick={() => update("programActive", !config.programActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition active:scale-[0.98] ${
                    config.programActive ? "bg-forest" : "bg-cream-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      config.programActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          </fieldset>

          {/* Reglas de acumulacion */}
          <fieldset className="rounded-2xl border border-line bg-cream-elev p-5 shadow-card">
            <legend className="mb-4 font-display text-base font-semibold text-ink">
              Reglas de acumulacion
            </legend>
            <div className="space-y-4">
              <Field label="Monto minimo para sello (CLP)">
                <div className="flex items-center overflow-hidden rounded-xl border border-line bg-cream transition focus-within:border-mustard-deep focus-within:ring-2 focus-within:ring-mustard-deep/25">
                  <span className="border-r border-line bg-cream-muted px-3 py-2.5 text-sm font-medium text-ink-muted">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={config.minAmount}
                    onChange={(e) => update("minAmount", Number(e.target.value))}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-ink focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Maximo de sellos por dia por cliente">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.maxStampsPerDay}
                  onChange={(e) => update("maxStampsPerDay", Number(e.target.value))}
                  className="input-base w-24"
                />
              </Field>
              <Field label="Vigencia de sellos (meses)">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={config.stampValidityMonths}
                  onChange={(e) => update("stampValidityMonths", Number(e.target.value))}
                  className="input-base w-24"
                />
              </Field>
            </div>
          </fieldset>

          {/* Identidad visual */}
          <fieldset className="rounded-2xl border border-line bg-cream-elev p-5 shadow-card">
            <legend className="mb-4 font-display text-base font-semibold text-ink">
              Identidad visual
            </legend>
            <Field label="Color principal">
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => update("brandColor", preset.value)}
                    className={`h-8 w-8 rounded-full transition active:scale-[0.98] ${
                      config.brandColor === preset.value
                        ? "ring-2 ring-ink ring-offset-2"
                        : "hover:ring-2 hover:ring-ink/30 hover:ring-offset-1"
                    }`}
                    style={{ background: preset.value }}
                  />
                ))}
                <input
                  type="color"
                  value={config.brandColor}
                  onChange={(e) => update("brandColor", e.target.value)}
                  title="Color personalizado"
                  className="h-8 w-8 cursor-pointer rounded-full border border-line bg-cream p-0.5"
                />
                <span className="ml-1 font-mono text-xs text-ink-muted">{config.brandColor}</span>
              </div>
            </Field>
          </fieldset>

          {/* Boton guardar */}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-6 py-3.5 text-base font-bold text-ink transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            style={{ background: "var(--brand-mustard)" }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>

        {/* Preview del pase — se actualiza en tiempo real */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">
            Preview en tiempo real
          </p>
          <PassPreview config={config} />
        </div>
      </div>
    </div>
  );
}

function PassPreview({ config }: { config: Config }): JSX.Element {
  const gradientBg = `linear-gradient(135deg, ${config.brandColor} 0%, ${lighten(config.brandColor, -15)} 60%, ${lighten(config.brandColor, -30)} 100%)`;

  return (
    <div className="overflow-hidden rounded-pass shadow-pass" style={{ background: "var(--brand-cream-elev)" }}>
      {/* Header con color configurable */}
      <div className="relative px-5 py-5" style={{ background: gradientBg }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            opacity: 0.06,
          }}
        />
        <div className="relative flex items-center justify-between">
          <FrittesMark className="h-10 w-10" />
          <div className="text-right leading-tight">
            <p className="font-display text-base font-bold text-ink">FRITTES</p>
            <p className="-mt-0.5 font-script text-lg leading-none text-ink">- maison -</p>
          </div>
        </div>
        <p className="relative mt-3 text-[10px] font-semibold uppercase tracking-wider2 text-ink/65">
          Club Frittes
        </p>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="text-[9px] uppercase tracking-wider2 text-ink-muted">miembro</p>
        <p className="mt-0.5 font-display text-xl font-semibold text-ink">Vista Previa</p>
        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-cream-muted px-2 py-0.5 text-[10px] text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.brandColor }} />
          Maisonero
        </p>

        <div className="mt-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-wider2 text-ink-muted">Sellos</p>
              <p className="flex items-baseline gap-1 font-display text-ink">
                <span className="text-4xl font-bold">5</span>
                <span className="text-sm text-ink-muted">/ {config.stampsRequired}</span>
              </p>
            </div>
            <span className="text-right text-[10px] text-ink-muted">
              faltan {config.stampsRequired - 5}
              <br />
              para {config.rewardName}
            </span>
          </div>
          <div className="mt-2">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: "var(--brand-cream-muted)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round((5 / config.stampsRequired) * 100)}%`,
                  background: config.brandColor,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* QR strip simulado */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ background: "var(--brand-cream-muted)" }}
      >
        <div className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-xl bg-white ring-1 ring-line">
          <span className="text-2xl">▦</span>
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-wider2 text-ink-muted">N° de pase</p>
          <p className="font-mono text-xs font-semibold text-ink">FRT-001</p>
          <p className="mt-1 text-[8px] uppercase tracking-wider2 text-ink-muted">Miembro · may. 2025</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      {children}
    </div>
  );
}

// Ajusta el brillo de un color hex para el gradiente del header.
function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
