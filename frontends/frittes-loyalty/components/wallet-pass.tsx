"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { FrittesMark } from "@/components/frittes-mark";
import { track } from "@/lib/analytics";
import type { LoyaltyCustomerDto } from "@/lib/api";
import type { FrittesBranding } from "@/lib/branding";

type WalletPassTier = {
  stamps_required: number;
  reward_name: string;
};

type WalletPassLevel = {
  number: number;
  name: string;
  stamps_required: number;
};

type WalletPassProps = {
  account: LoyaltyCustomerDto;
  branding: FrittesBranding;
  tiers: WalletPassTier[];
  levels?: WalletPassLevel[];
  levelLabel?: string;
  qrToken: string | null;
  isQrExpired: boolean;
  onRefreshQr: () => void;
};

const CONFETTI_COLORS = [
  "#FFD23F",
  "#2D5A3F",
  "#1A1815",
  "#E8B82E",
  "#F5C200",
  "#2D5A3F",
  "#FFD23F",
  "#1A1815",
];

export function WalletPass({
  account,
  branding,
  tiers,
  levels = [],
  levelLabel,
  qrToken,
  isQrExpired,
  onRefreshQr,
}: WalletPassProps): JSX.Element {
  const label = levelLabel ?? account.level_label ?? "Nivel";
  const sortedLevels = useMemo(
    () => [...levels].sort((a, b) => a.stamps_required - b.stamps_required),
    [levels],
  );
  const currentLevel = account.current_level ?? null;
  const nextLevel = account.next_level ?? null;
  const levelProgressPct = nextLevel
    ? Math.min(
        100,
        Math.round(
          ((account.lifetime_stamps - (currentLevel?.stamps_required ?? 0)) /
            Math.max(1, nextLevel.stamps_required - (currentLevel?.stamps_required ?? 0))) *
            100,
        ),
      )
    : 100;
  const [flipped, setFlipped] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiFired = useRef(false);

  const memberSince = useMemo(
    () =>
      new Date(account.member_since).toLocaleDateString(branding.currency.locale, {
        month: "short",
        year: "numeric",
      }),
    [account.member_since, branding.currency.locale],
  );
  const cardNumber = account.id.replace("frt_", "").toUpperCase().padStart(6, "0");

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.stamps_required - b.stamps_required),
    [tiers],
  );
  // Premio más cercano que el cliente aún no alcanza — es la meta visible del pase.
  const nextTier = sortedTiers.find((t) => account.stamps < t.stamps_required);
  // Premios que el cliente ya puede canjear ahora.
  const readyTiers = sortedTiers.filter((t) => account.stamps >= t.stamps_required);
  const hasReward = readyTiers.length > 0;
  const goal = nextTier?.stamps_required ?? account.threshold;
  const goalName = nextTier?.reward_name ?? branding.rewardCopy;
  const progressPct = Math.min((account.stamps / goal) * 100, 100);
  const ready = hasReward;

  useEffect(() => {
    if (ready && !confettiFired.current) {
      confettiFired.current = true;
      setShowConfetti(true);
      const timer = window.setTimeout(() => setShowConfetti(false), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [ready]);

  return (
    <div
      className="group relative mx-auto w-full max-w-sm animate-pass-rise"
      style={{ perspective: "1200px" }}
    >
      {/* Confetti — se dispara una vez al alcanzar el threshold */}
      {showConfetti && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-pass"
        >
          {CONFETTI_COLORS.map((color, i) => (
            <span
              key={i}
              className="confetti-piece absolute top-0 block h-2 w-2 rounded-sm"
              style={{
                left: `${8 + i * 11}%`,
                background: color,
                animationDelay: `${i * 0.13}s`,
              }}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label="Voltear tarjeta"
        onClick={() => setFlipped((f) => !f)}
        onClickCapture={() => track("pass_flipped")}
        className="relative block w-full transition-transform duration-700 ease-out [transform-style:preserve-3d]"
        style={{
          aspectRatio: "1 / 1.55",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── FRENTE ── */}
        <div
          className="pass-shine absolute inset-0 overflow-hidden rounded-pass shadow-pass [backface-visibility:hidden]"
          style={{ background: "var(--brand-cream-elev)" }}
        >
          {/* Header — gradiente sutil + patron de puntos */}
          <header
            className="relative px-6 pb-5 pt-6 text-ink"
            style={{
              background:
                "linear-gradient(135deg, #FFD23F 0%, #F5C200 60%, #E8B82E 100%)",
            }}
          >
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
              <FrittesMark className="h-12 w-12" />
              <img
                src="/frittes-logo.png"
                alt="Frittes Maison"
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="relative mt-4 text-[10px] font-semibold uppercase tracking-wider2 text-ink/65">
              {branding.programName}
            </p>
          </header>

          {/* Body crema */}
          <section className="px-6 pb-36 pt-5">
            <p className="text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
              {branding.memberLabel}
            </p>
            <p className="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink">
              {account.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-cream">
              <span className="text-[9px] font-bold uppercase tracking-wider2 text-mustard">
                {account.level_label ?? "Nivel"} {account.current_level?.number ?? 1}
              </span>
              <span className="h-2.5 w-px bg-cream/30" />
              <span>{account.current_level?.name ?? account.tier}</span>
            </p>

            <div className="mt-5 border-b border-dashed border-line pb-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
                    Sellos
                  </p>
                  <p className="mt-0.5 flex items-baseline gap-1.5 font-display tracking-tight text-ink">
                    <span className="text-5xl font-bold tabular-nums">{account.stamps}</span>
                    <span className="text-base font-medium text-ink-muted">/ {goal}</span>
                  </p>
                </div>
                {nextTier ? (
                  <span className="text-right text-[11px] font-medium text-ink-muted">
                    faltan {goal - account.stamps}
                    <br />
                    para {goalName}
                  </span>
                ) : (
                  <span className="rounded-full bg-forest px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider2 text-cream">
                    ¡Todo listo!
                  </span>
                )}
              </div>

              {/* Barra de progreso hacia el premio más cercano */}
              <div className="mt-3">
                <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider2 text-ink-muted">
                  {nextTier
                    ? `${goal - account.stamps} mas para ${goalName}`
                    : "Todas las recompensas disponibles"}
                </p>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--brand-cream-muted)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPct}%`,
                      background: "var(--brand-mustard-deep)",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ticket — premio(s) listo(s) para canjear en caja */}
            {hasReward && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-mustard-deep bg-mustard/20 px-3 py-2.5">
                <span className="text-2xl leading-none">🎟️</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold uppercase tracking-wider2 text-mustard-deep">
                    {readyTiers.length === 1
                      ? "Premio para canjear"
                      : `${readyTiers.length} premios para canjear`}
                  </p>
                  <p className="truncate font-display text-sm font-semibold text-ink">
                    {readyTiers.map((t) => t.reward_name).join(" · ")}
                  </p>
                  <p className="mt-0.5 text-[9px] text-ink-muted">
                    Muestra este pase en caja
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Strip QR */}
          <section
            className="absolute inset-x-0 bottom-0 px-5 py-3"
            style={{ background: "var(--brand-cream-muted)" }}
          >
            <div className="flex items-center gap-3">
              <div className="relative flex-none">
                <div
                  className={`rounded-xl bg-white p-1.5 ring-1 ring-line ${isQrExpired ? "opacity-40" : ""}`}
                >
                  <QRCodeSVG
                    value={qrToken || "pending"}
                    size={96}
                    bgColor="#ffffff"
                    fgColor="#1A1815"
                  />
                </div>
                {isQrExpired ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRefreshQr();
                    }}
                    className="absolute inset-0 z-10 rounded-xl bg-cream/90 text-[10px] font-semibold uppercase tracking-wider2 text-ink active:scale-[0.98]"
                  >
                    Refrescar
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-[9px] font-medium uppercase tracking-wider2 text-ink-muted">
                  N° de pase
                </p>
                <p className="font-mono text-sm font-semibold tracking-[0.15em] text-ink">
                  {cardNumber}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider2 text-ink-muted">
                  Miembro · {memberSince}
                </p>
                {/* Pill animado — reemplaza el texto invisible de flip */}
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider2 text-ink-muted">
                    <svg
                      aria-hidden
                      className="h-3 w-3 animate-spin-slow"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    </svg>
                    ver sellos
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ── DORSO — grilla de sellos + info ── */}
        <div
          className="absolute inset-0 overflow-hidden rounded-pass shadow-pass [backface-visibility:hidden]"
          style={{
            transform: "rotateY(180deg)",
            background: "var(--brand-cream-elev)",
          }}
        >
          <header
            className="relative px-6 pb-4 pt-5 text-ink"
            style={{ background: "var(--brand-ink)", color: "var(--brand-cream)" }}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-bold tracking-tight text-cream">
                FRITTES <span className="font-script text-mustard">maison</span>
              </p>
              <FrittesMark className="h-9 w-9" fillInk="var(--brand-cream)" />
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider2 text-cream/60">
              Tu coleccion de sellos
            </p>
          </header>

          <section className="p-5 pb-14">
            <StampGrid stamps={account.stamps} threshold={account.threshold} tiers={tiers} />
            {tiers.length > 0 ? (
              <p className="mt-2 text-center text-[9px] uppercase tracking-wider2 text-ink-muted">
                🎁 recompensa en el sello {tiers.map((t) => t.stamps_required).join(" · ")}
              </p>
            ) : null}

            {sortedLevels.length > 0 ? (
              <div className="mt-4 rounded-xl border border-line bg-cream-muted/40 p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-[9px] font-semibold uppercase tracking-wider2 text-ink-muted">
                    Tu {label.toLowerCase()}
                  </p>
                  {nextLevel ? (
                    <p className="text-[9px] font-medium text-ink-muted">
                      {nextLevel.stamps_required - account.lifetime_stamps} para {label} {nextLevel.number}
                    </p>
                  ) : (
                    <p className="text-[9px] font-semibold uppercase tracking-wider2 text-mustard-deep">
                      Nivel máximo
                    </p>
                  )}
                </div>
                <p className="mt-1 font-display text-base font-semibold text-ink">
                  {label} {currentLevel?.number ?? 1}{" "}
                  <span className="text-ink-muted">·</span>{" "}
                  <span className="text-mustard-deep">{currentLevel?.name ?? sortedLevels[0]?.name}</span>
                </p>
                <div
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--brand-cream)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${levelProgressPct}%`,
                      background: "var(--brand-mustard-deep)",
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sortedLevels.map((l) => {
                    const reached = account.lifetime_stamps >= l.stamps_required;
                    const isCurrent = currentLevel?.number === l.number;
                    return (
                      <span
                        key={l.number}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          isCurrent
                            ? "bg-ink text-cream"
                            : reached
                              ? "bg-mustard/40 text-ink"
                              : "bg-cream-muted text-ink-muted"
                        }`}
                      >
                        {reached ? "✓" : "🔒"} {label} {l.number}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Total historico" value={`${account.lifetime_stamps}`} />
              <DetailRow label="Canjes" value={`${account.redemptions}`} />
              <DetailRow label="Telefono" value={account.phone} />
              <DetailRow label="Alta" value={memberSince} />
            </dl>
          </section>

          <footer className="absolute inset-x-0 bottom-0 border-t border-line bg-cream-muted px-5 py-3 text-center text-[10px] uppercase tracking-wider2 text-ink-muted">
            Toca para volver al frente ↻
          </footer>
        </div>
      </button>
    </div>
  );
}

function StampGrid({
  stamps,
  threshold,
  tiers,
}: {
  stamps: number;
  threshold: number;
  tiers: WalletPassTier[];
}): JSX.Element {
  const filled =
    stamps % threshold || (stamps > 0 && stamps % threshold === 0 ? threshold : 0);
  const cols = threshold <= 8 ? 4 : 5;
  const milestoneStamps = new Set(tiers.map((t) => t.stamps_required));

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: threshold }).map((_, i) => {
        const isFilled = i < filled;
        const isMilestone = milestoneStamps.has(i + 1);
        return (
          <div
            key={i}
            className={`relative grid aspect-square place-items-center rounded-xl border-2 transition ${
              isFilled
                ? "border-mustard-deep bg-mustard"
                : "border-dashed border-line bg-cream-muted/40"
            } ${isMilestone ? "ring-2 ring-forest ring-offset-1" : ""}`}
          >
            {isMilestone ? (
              <span className="text-lg leading-none">🎁</span>
            ) : isFilled ? (
              <div className="animate-stamp-in">
                <FrittesMark className="h-7 w-7" />
              </div>
            ) : (
              <span className="block h-5 w-5 rounded-full border-[1.5px] border-dashed border-ink-muted/30" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="rounded-lg bg-cream-muted/50 px-3 py-2">
      <dt className="text-[9px] font-medium uppercase tracking-wider2 text-ink-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}
