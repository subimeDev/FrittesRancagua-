"use client";

import { useEffect, useRef, useState } from "react";

// ─── Persistencia ─────────────────────────────────────────────────────────

const REWARDS_KEY = "frittes-celebrated";
const CAT_COUNT_KEY = "frittes-cat-count";

type Tier = { stamps_required: number; reward_name: string };

function getNewRewards(customerId: string, tiers: Tier[]): Tier[] {
  try {
    const raw = localStorage.getItem(REWARDS_KEY) ?? "[]";
    const celebrated = new Set(JSON.parse(raw) as string[]);
    return tiers.filter((t) => !celebrated.has(`${customerId}:${t.stamps_required}`));
  } catch { return tiers; }
}

function markCelebrated(customerId: string, tiers: Tier[]): void {
  try {
    const raw = localStorage.getItem(REWARDS_KEY) ?? "[]";
    const celebrated = new Set(JSON.parse(raw) as string[]);
    tiers.forEach((t) => celebrated.add(`${customerId}:${t.stamps_required}`));
    localStorage.setItem(REWARDS_KEY, JSON.stringify([...celebrated]));
  } catch {}
}

// ─── Qué gato mostrar ──────────────────────────────────────────────────────
// Si hay tiers configurados: índice del primer premio nuevo (1-4).
// Si no hay tiers (modelo de umbral único): contador por cliente (cicla 1-4).

function computeCatLevel(customerId: string, newRewards: Tier[], allTiers: Tier[]): number {
  if (allTiers.length > 0 && newRewards.length > 0) {
    const sorted = [...allTiers].sort((a, b) => a.stamps_required - b.stamps_required);
    const idx = sorted.findIndex((t) => t.stamps_required === newRewards[0].stamps_required);
    return Math.min(Math.max(idx + 1, 1), 4);
  }
  // modelo umbral único: cicla entre 1 y 4 según veces que ya celebró
  try {
    const n = parseInt(localStorage.getItem(`${CAT_COUNT_KEY}:${customerId}`) ?? "0", 10) || 0;
    return (n % 4) + 1;
  } catch { return 1; }
}

function incrementCatCount(customerId: string): void {
  try {
    const n = parseInt(localStorage.getItem(`${CAT_COUNT_KEY}:${customerId}`) ?? "0", 10) || 0;
    localStorage.setItem(`${CAT_COUNT_KEY}:${customerId}`, String(n + 1));
  } catch {}
}

// ─── Confetti ──────────────────────────────────────────────────────────────

const CONFETTI: Array<{ color: string; x: number; delay: number; w: number; h: number }> = [
  { color: "#1A1815", x: 5,  delay: 0.00, w: 8,  h: 14 },
  { color: "#2D5A3F", x: 14, delay: 0.20, w: 10, h: 8  },
  { color: "#FFD23F", x: 25, delay: 0.09, w: 12, h: 10 },
  { color: "#E8B82E", x: 36, delay: 0.33, w: 7,  h: 12 },
  { color: "#1A1815", x: 48, delay: 0.14, w: 9,  h: 9  },
  { color: "#FFD23F", x: 58, delay: 0.46, w: 11, h: 7  },
  { color: "#2D5A3F", x: 70, delay: 0.07, w: 8,  h: 13 },
  { color: "#E8B82E", x: 79, delay: 0.27, w: 10, h: 9  },
  { color: "#FFD23F", x: 89, delay: 0.17, w: 9,  h: 10 },
  { color: "#1A1815", x: 43, delay: 0.52, w: 7,  h: 8  },
  { color: "#2D5A3F", x: 21, delay: 0.39, w: 11, h: 11 },
  { color: "#E8B82E", x: 63, delay: 0.56, w: 8,  h: 9  },
  { color: "#FFD23F", x: 54, delay: 0.23, w: 6,  h: 14 },
  { color: "#1A1815", x: 83, delay: 0.43, w: 10, h: 7  },
];

// ─── Props ─────────────────────────────────────────────────────────────────

type Props = {
  customerId: string;
  customerName: string;
  /** Premios recién alcanzados (sin canjear aún). */
  readyTiers: Tier[];
  /** Todos los tiers del programa, para calcular el número de nivel del gato. */
  allTiers: Tier[];
};

type ShowState = {
  newRewards: Tier[];
  catLevel: number;
};

// ─── Componente ────────────────────────────────────────────────────────────

export function CelebrationOverlay({
  customerId,
  customerName,
  readyTiers,
  allTiers,
}: Props): JSX.Element | null {
  const [show, setShow] = useState<ShowState | null>(null);
  const [entered, setEntered] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || readyTiers.length === 0) return;
    checked.current = true;

    const newRewards = getNewRewards(customerId, readyTiers);
    if (newRewards.length === 0) return;

    const catLevel = computeCatLevel(customerId, newRewards, allTiers);
    setShow({ newRewards, catLevel });
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
  }, [customerId, readyTiers, allTiers]);

  if (!show) return null;

  const firstName = customerName.split(" ")[0];

  function dismiss(): void {
    markCelebrated(customerId, show!.newRewards);
    // Si no hay tiers configurados, avanzar el contador para el próximo ciclo
    if (allTiers.length === 0) incrementCatCount(customerId);
    setEntered(false);
    setTimeout(() => setShow(null), 440);
  }

  const { newRewards, catLevel } = show;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="¡Premio disponible!"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{
        backgroundColor: entered ? "rgba(26,24,21,0.72)" : "rgba(26,24,21,0)",
        backdropFilter:       entered ? "blur(10px)" : "blur(0px)",
        WebkitBackdropFilter: entered ? "blur(10px)" : "blur(0px)",
        transition: "background-color 400ms ease, backdrop-filter 400ms ease, -webkit-backdrop-filter 400ms ease",
      }}
      onClick={dismiss}
    >
      {/* ── Tarjeta ── */}
      <div
        className="relative mx-auto w-full max-w-sm overflow-hidden rounded-t-[2.5rem] sm:rounded-[2.5rem]"
        style={{
          transform: entered ? "translateY(0) scale(1)" : "translateY(72px) scale(0.96)",
          opacity:   entered ? 1 : 0,
          transition: "transform 460ms cubic-bezier(0.34,1.56,0.64,1), opacity 360ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Imagen del gato ── */}
        {/* pt-5 px-4 evita que las esquinas redondeadas del modal corten la imagen */}
        <div
          className="relative px-4 pt-5 pb-1"
          style={{ background: "#F6F1DD" }}
        >
          {/* Confetti sobre la imagen */}
          <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                aria-hidden
                className="confetti-piece absolute top-0 rounded-[3px]"
                style={{
                  left: `${c.x}%`,
                  width: c.w,
                  height: c.h,
                  background: c.color,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}
          </div>

          <img
            src={`/level-cat-${catLevel}.png`}
            alt={`¡Nivel ${catLevel} completado!`}
            className="w-full rounded-3xl"
            draggable={false}
          />
        </div>

        {/* ── Cuerpo crema ── */}
        <div className="bg-cream px-6 pb-8 pt-5">
          <p className="text-center font-display text-2xl font-bold text-ink">
            ¡Felicidades, {firstName}!
          </p>
          <p className="mt-1 text-center text-sm text-ink-muted">
            Completaste tus sellos y{" "}
            {newRewards.length === 1
              ? "tienes un premio listo"
              : `tienes ${newRewards.length} premios listos`}{" "}
            para canjear.
          </p>

          {/* Premio(s) */}
          <div className="mt-5 space-y-2.5">
            {newRewards.map((t) => (
              <div
                key={t.stamps_required}
                className="flex items-center gap-3.5 rounded-2xl border-2 border-mustard-deep/35 bg-mustard/20 px-4 py-4"
              >
                <span className="flex-none text-3xl leading-none">🎁</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider2 text-mustard-deep">
                    Premio disponible
                  </p>
                  <p className="truncate font-display text-base font-semibold text-ink">
                    {t.reward_name}
                  </p>
                </div>
                <span className="flex-none rounded-full bg-mustard-deep/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-mustard-deep">
                  ¡Listo!
                </span>
              </div>
            ))}
          </div>

          {/* Instrucción */}
          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-ink/5 px-4 py-3.5">
            <span className="mt-0.5 flex-none text-xl leading-none">📲</span>
            <p className="text-[11.5px] leading-relaxed text-ink-muted">
              Muestra tu tarjeta al cajero y pídele que escanee tu código QR para canjear.
            </p>
          </div>

          {/* Botón CTA */}
          <button
            type="button"
            onClick={dismiss}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-[1.05rem] font-display text-base font-semibold text-cream shadow-card transition active:scale-[0.97]"
          >
            ¡Entendido, voy a canjear!
            <span className="text-mustard">→</span>
          </button>

          <p className="mt-3 text-center text-[10px] uppercase tracking-wider2 text-ink/25">
            toca en cualquier parte para cerrar
          </p>
        </div>
      </div>
    </div>
  );
}
