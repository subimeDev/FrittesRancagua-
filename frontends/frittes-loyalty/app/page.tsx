"use client";

import { useEffect, useRef, useState } from "react";

import { AuthFlow } from "@/components/auth-flow";
import { CelebrationOverlay } from "@/components/celebration-overlay";
import { InstallButton } from "@/components/install-prompt";
import { SkeletonPass } from "@/components/skeleton-pass";
import { toast } from "@/components/toast";
import { WalletPass } from "@/components/wallet-pass";
import { track } from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { branding, instagramUrl, whatsappUrl } from "@/lib/branding";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useQrToken } from "@/lib/use-qr-token";
import { useLoyaltyAccount } from "@/lib/use-loyalty-account";

type RewardTier = { stamps_required: number; reward_name: string };
type CardLevel = { number: number; name: string; stamps_required: number };
type ProgramConfig = {
  threshold: number;
  reward_name: string;
  tier_name: string;
  tiers: RewardTier[];
  levels?: CardLevel[];
  level_label?: string;
};
type TierStatus = "available" | "locked";
type TierView = RewardTier & { status: TierStatus };

export default function HomePage(): JSX.Element {
  const { state, sessionToken, refresh, signOut } = useLoyaltyAccount(branding.slug);
  const { token: qrToken, isExpired, refresh: refreshQr, secondsLeft } = useQrToken(sessionToken);
  const isOnline = useOnlineStatus();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [programConfig, setProgramConfig] = useState<ProgramConfig | null>(null);
  const viewedPass = useRef(false);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";
    fetch(`${apiUrl}/loyalty/program-config`, {
      headers: { "X-Restaurant-Id": restaurantId },
    })
      .then((r) => r.json())
      .then((cfg: unknown) => {
        if (cfg && typeof cfg === "object" && "reward_name" in cfg) {
          setProgramConfig(cfg as ProgramConfig);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isOnline) {
      void refresh();
    }
  }, [isOnline, refresh]);

  useEffect(() => {
    if (state.status !== "authenticated" || viewedPass.current) return;
    viewedPass.current = true;
    track("pass_viewed");
  }, [state.status]);

  useEffect(() => {
    if (state.status === "unauthenticated" && state.reason === "not_found") {
      toast.error("Tu cuenta ya no esta activa");
    }
  }, [state]);

  if (state.status === "loading") {
    return (
      <main className="relative mx-auto min-h-screen max-w-3xl px-5 py-8">
        <SkeletonPass />
      </main>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <main className="relative mx-auto min-h-screen max-w-3xl px-5 py-10">
        <AuthFlow
          branding={branding}
          onAuthenticated={() => {
            void refresh();
          }}
        />
        <Footer />
      </main>
    );
  }

  const account = state.account;
  const ready = account.stamps >= account.threshold;
  const progressPct = Math.min((account.stamps / account.threshold) * 100, 100);
  const effectiveBranding = programConfig
    ? { ...branding, rewardCopy: programConfig.reward_name }
    : branding;
  const rewardCopy = effectiveBranding.rewardCopy;

  const tierViews: TierView[] = (programConfig?.tiers ?? [])
    .slice()
    .sort((a, b) => a.stamps_required - b.stamps_required)
    .map((t) => ({
      ...t,
      status: account.stamps >= t.stamps_required ? "available" : "locked",
    }));
  const nextTier = tierViews.find((t) => t.status === "locked");
  const readyTiers = tierViews.filter((t) => t.status === "available");

  // Cubre tanto el modelo de tiers como el modelo de umbral único
  const celebrationTiers: Array<{ stamps_required: number; reward_name: string }> =
    readyTiers.length > 0
      ? readyTiers
      : ready
        ? [{ stamps_required: account.threshold, reward_name: rewardCopy }]
        : [];

  return (
    <main className="relative mx-auto min-h-screen max-w-3xl px-5 py-8">
      <CelebrationOverlay
        customerId={account.id}
        customerName={account.name}
        readyTiers={celebrationTiers}
        allTiers={programConfig?.tiers ?? []}
      />
      {!isOnline ? (
        <div className="mb-4 rounded-lg border border-line bg-cream-muted px-3 py-2 text-xs text-ink-muted">
          Sin conexion - mostrando datos guardados
        </div>
      ) : null}
      {state.isStale ? (
        <div className="mb-4 rounded-lg border border-line bg-cream-muted px-3 py-2 text-xs text-ink-muted">
          Mostrando ultima informacion disponible.
        </div>
      ) : null}

      {/* Header marca */}
      <header className="mb-6 flex items-center justify-between">
        <img
          src="/frittes-logo.png"
          alt="Frittes Maison"
          className="h-24 w-auto object-contain"
          
        />
        <button
          type="button"
          disabled={isSigningOut}
          onClick={() => {
            setIsSigningOut(true);
            void signOut()
              .then(() => {
                track("signed_out");
              })
              .finally(() => setIsSigningOut(false));
          }}
          className="text-xs font-medium text-ink-muted transition hover:text-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
        </button>
      </header>

      {/* Saludo */}
      <section className="mb-7 text-center">
        <p className="font-script text-3xl text-ink">
          ¡Hola, {account.name.split(" ")[0]}!
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          {readyTiers.length > 0
            ? `Tienes ${readyTiers.length} ${readyTiers.length === 1 ? "premio listo" : "premios listos"} para canjear.`
            : nextTier
              ? `Te faltan ${nextTier.stamps_required - account.stamps} sellos para ${nextTier.reward_name}.`
              : ready
                ? `Tienes ${account.stamps} sellos. Puedes canjear ${rewardCopy}.`
                : `Te faltan ${account.threshold - account.stamps} sellos para ${rewardCopy}.`}
        </p>
      </section>

      {/* PASE */}
      <WalletPass
        account={account}
        branding={effectiveBranding}
        tiers={tierViews}
        levels={programConfig?.levels ?? []}
        levelLabel={programConfig?.level_label ?? account.level_label ?? "Nivel"}
        qrToken={qrToken}
        isQrExpired={isExpired}
        onRefreshQr={() => {
          void refreshQr()
            .then(() => {
              track("qr_refreshed");
            })
            .catch(async (error: unknown) => {
              if (error instanceof ApiError && error.code === "unauthenticated") {
                await signOut();
                return;
              }
              if (error instanceof ApiError && error.code === "rate_limited") {
                toast.error("Muchos intentos. Intenta en unos segundos.");
                return;
              }
              toast.error("Algo no salio bien. Reintenta.");
            });
        }}
      />
      <p className="mt-2 text-center text-[11px] text-ink-muted">
        QR {isExpired ? "expirado" : `vigente (${secondsLeft}s)`}
      </p>

      {/* Recompensas del club — cada hito con su estado */}
      <section className="mx-auto mt-5 max-w-sm">
        <div className="rounded-2xl border border-line bg-cream-muted/50 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider2 text-ink-muted">
            Recompensas del club
          </p>
          {tierViews.length > 0 ? (
            <ul className="mt-2.5 space-y-2.5">
              {tierViews.map((t) => {
                const reached = Math.min(account.stamps, t.stamps_required);
                const pct = Math.round((reached / t.stamps_required) * 100);
                const isReady = t.status === "available";
                return (
                  <li key={t.stamps_required} className="flex items-center gap-3">
                    <span
                      className={`grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-bold ${
                        isReady ? "bg-mustard text-ink" : "bg-cream-muted text-ink-muted"
                      }`}
                    >
                      {isReady ? "🎟️" : t.stamps_required}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-semibold text-ink">
                        {t.reward_name}
                      </p>
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                        style={{ background: "var(--brand-cream)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: "var(--brand-mustard-deep)",
                          }}
                        />
                      </div>
                    </div>
                    <span
                      className={`flex-none text-[10px] font-semibold uppercase tracking-wider2 ${
                        isReady ? "text-mustard-deep" : "text-ink-muted"
                      }`}
                    >
                      {isReady ? "¡Listo!" : `${t.stamps_required - account.stamps} más`}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2 flex items-start gap-3">
              <span className="text-2xl leading-none">🎁</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold text-ink">{rewardCopy}</p>
                <div className="mt-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-ink-muted">
                      {ready
                        ? "¡Listo para canjear!"
                        : `${account.stamps} de ${account.threshold} sellos`}
                    </span>
                    <span className="text-[10px] font-semibold text-mustard-deep">
                      {Math.round(progressPct)}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--brand-cream)" }}
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
            </div>
          )}
        </div>
      </section>

      <InstallButton />

      <Footer />
    </main>
  );
}

function Footer(): JSX.Element {
  return (
    <footer className="mt-12 border-t border-line pt-6 text-center text-xs text-ink-muted">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <a
          href={whatsappUrl(
            branding.contact.whatsappPhone,
            "Hola Frittes, quiero hacer un pedido",
          )}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-ink underline-offset-2 hover:underline"
        >
          🛵 Delivery {branding.contact.whatsappPhone}
        </a>
        <span aria-hidden className="text-ink-muted/50">
          ·
        </span>
        <a
          href={instagramUrl(branding.contact.instagram)}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-ink underline-offset-2 hover:underline"
        >
          {branding.contact.instagram}
        </a>
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-wider2">
        © {new Date().getFullYear()} {branding.name} {branding.subtitle}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3 text-[10px] uppercase tracking-wider2">
        <a href="/legal/privacidad" target="_blank" rel="noreferrer" className="underline">
          Privacidad
        </a>
        <span>·</span>
        <a href="/legal/terminos" target="_blank" rel="noreferrer" className="underline">
          Terminos
        </a>
      </div>
    </footer>
  );
}
