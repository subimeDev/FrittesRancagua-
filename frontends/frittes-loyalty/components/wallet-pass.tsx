"use client";

import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { FrittesMark } from "@/components/frittes-mark";
import { track } from "@/lib/analytics";
import type { LoyaltyCustomerDto } from "@/lib/api";
import type { FrittesBranding } from "@/lib/branding";

type WalletPassProps = {
  account: LoyaltyCustomerDto;
  branding: FrittesBranding;
  qrToken: string | null;
  isQrExpired: boolean;
  onRefreshQr: () => void;
};

/**
 * Tarjeta wallet de Frittes Maison.
 *
 * Estructura inspirada en un pase real de Apple/Google Wallet:
 *  - Header con color de marca + logo + nombre del programa
 *  - Body con titular y dato grande (sellos)
 *  - Strip inferior con QR de validacion
 *  - Tap para girar y ver dorso (sellos individuales + info)
 *
 * Aspecto wallet, no credit-card: ratio mas vertical (~1.27:1), header
 * solido y QR strip prominente.
 */
export function WalletPass({
  account,
  branding,
  qrToken,
  isQrExpired,
  onRefreshQr,
}: WalletPassProps): JSX.Element {
  const [flipped, setFlipped] = useState(false);
  const memberSince = useMemo(
    () =>
      new Date(account.member_since).toLocaleDateString(branding.currency.locale, {
        month: "short",
        year: "numeric",
      }),
    [account.member_since, branding.currency.locale],
  );
  const cardNumber = account.id.replace("frt_", "").toUpperCase().padStart(6, "0");
  const ready = account.stamps >= account.threshold;

  return (
    <div
      className="group relative mx-auto w-full max-w-sm animate-pass-rise"
      style={{ perspective: "1200px" }}
    >
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
        {/* FRENTE */}
        <div
          className="pass-shine absolute inset-0 overflow-hidden rounded-pass shadow-pass [backface-visibility:hidden]"
          style={{ background: "var(--brand-cream-elev)" }}
        >
          {/* Header amarillo */}
          <header
            className="relative px-6 pb-5 pt-6 text-ink"
            style={{ background: "var(--brand-mustard)" }}
          >
            {/* Splash decorativo arriba a la derecha */}
            <svg
              aria-hidden
              className="absolute right-4 top-3 h-6 w-6 opacity-80"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="6" cy="6" r="1.2" />
              <circle cx="14" cy="3" r="0.9" />
              <circle cx="20" cy="9" r="1.1" />
              <circle cx="11" cy="11" r="0.7" />
            </svg>

            <div className="flex items-center justify-between">
              <FrittesMark className="h-12 w-12" />
              <div className="text-right leading-tight">
                <p className="font-display text-[18px] font-bold tracking-tight">FRITTES</p>
                <p className="-mt-0.5 font-script text-[20px] leading-none text-ink">
                  - maison -
                </p>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider2 text-ink/65">
              {branding.programName}
            </p>
          </header>

          {/* Body crema */}
          <section className="px-6 py-5">
            <p className="text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
              {branding.memberLabel}
            </p>
            <p className="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink">
              {account.name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-cream-muted px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-mustard-deep" />
              {account.tier}
            </p>

            <div className="mt-5 flex items-end justify-between border-b border-dashed border-line pb-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
                  Sellos
                </p>
                <p className="mt-0.5 flex items-baseline gap-1.5 font-display tracking-tight text-ink">
                  <span className="text-5xl font-bold tabular-nums">{account.stamps}</span>
                  <span className="text-base font-medium text-ink-muted">
                    / {account.threshold}
                  </span>
                </p>
              </div>
              {ready ? (
                <span className="rounded-full bg-forest px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider2 text-cream">
                  Listo!
                </span>
              ) : (
                <span className="text-right text-[11px] font-medium text-ink-muted">
                  faltan {account.threshold - account.stamps}
                  <br />
                  para {branding.rewardCopy}
                </span>
              )}
            </div>
          </section>

          {/* Strip QR */}
          <section
            className="absolute inset-x-0 bottom-0 px-5 py-3"
            style={{ background: "var(--brand-cream-muted)" }}
          >
            <div className="flex items-center gap-3">
              {/* QR grande y centrado para fácil escaneo */}
              <div className="relative flex-none">
                <div className={`rounded-xl bg-white p-1.5 ring-1 ring-line ${isQrExpired ? "opacity-40" : ""}`}>
                  <QRCodeSVG value={qrToken || "pending"} size={96} bgColor="#ffffff" fgColor="#1A1815" />
                </div>
                {isQrExpired ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRefreshQr();
                    }}
                    className="absolute inset-0 z-10 rounded-xl bg-cream/90 text-[10px] font-semibold uppercase tracking-wider2 text-ink"
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
                <p className="mt-2 text-[9px] uppercase tracking-wider2 text-ink-muted/60">
                  Toca para ver el reverso ↻
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* DORSO — grilla de sellos + info */}
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

          <section className="p-5">
            <StampGrid stamps={account.stamps} threshold={account.threshold} />

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <DetailRow label="Total historico" value={`${account.lifetime_stamps}`} />
              <DetailRow label="Canjes" value={`${account.redemptions}`} />
              <DetailRow label="Telefono" value={account.phone} />
              <DetailRow label="Alta" value={memberSince} />
            </dl>
          </section>

          <footer
            className="absolute inset-x-0 bottom-0 border-t border-line bg-cream-muted px-5 py-3 text-center text-[10px] uppercase tracking-wider2 text-ink-muted"
          >
            Toca para volver al frente ↻
          </footer>
        </div>
      </button>
    </div>
  );
}

function StampGrid({ stamps, threshold }: { stamps: number; threshold: number }): JSX.Element {
  // Mostramos exactamente threshold celdas: las primeras `stamps % threshold`
  // estampadas, el resto en outline.
  const filled = stamps % threshold || (stamps > 0 && stamps % threshold === 0 ? threshold : 0);
  const cols = threshold <= 8 ? 4 : 5;

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: threshold }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <div
            key={i}
            className={`relative grid aspect-square place-items-center rounded-xl border-2 transition ${
              isFilled
                ? "border-mustard-deep bg-mustard"
                : "border-dashed border-line bg-cream-muted/40"
            }`}
          >
            {isFilled ? (
              <div className="animate-stamp-in">
                <FrittesMark className="h-7 w-7" />
              </div>
            ) : (
              <span className="text-xl font-bold text-ink-muted/30 tabular-nums">{i + 1}</span>
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
