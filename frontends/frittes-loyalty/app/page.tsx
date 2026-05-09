"use client";

import { useEffect, useRef, useState } from "react";

import { AddToWallet } from "@/components/add-to-wallet";
import { AuthFlow } from "@/components/auth-flow";
import { InstallPrompt } from "@/components/install-prompt";
import { SkeletonPass } from "@/components/skeleton-pass";
import { toast } from "@/components/toast";
import { WalletPass } from "@/components/wallet-pass";
import { track } from "@/lib/analytics";
import { ApiError } from "@/lib/api";
import { branding, instagramUrl, whatsappUrl } from "@/lib/branding";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useQrToken } from "@/lib/use-qr-token";
import { useLoyaltyAccount } from "@/lib/use-loyalty-account";

export default function HomePage(): JSX.Element {
  const { state, sessionToken, refresh, signOut } = useLoyaltyAccount(branding.slug);
  const { token: qrToken, isExpired, refresh: refreshQr, secondsLeft } = useQrToken(sessionToken);
  const isOnline = useOnlineStatus();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isRefreshingQr, setIsRefreshingQr] = useState(false);
  const [isOpeningWallet, setIsOpeningWallet] = useState(false);
  const viewedPass = useRef(false);

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

  async function handleWallet(): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      toast.error("Falta NEXT_PUBLIC_API_URL.");
      return;
    }

    setIsOpeningWallet(true);
    try {
      track("google_wallet_clicked");
      const headers: Record<string, string> = {
        "X-Restaurant-Id": process.env.NEXT_PUBLIC_RESTAURANT_ID || "frittes-maison",
      };
      if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;
      const response = await fetch(`${apiUrl}/loyalty/passes/google/me`, {
        headers,
        credentials: "include",
      });
      if (response.status === 401) {
        await signOut();
        return;
      }
      if (!response.ok) throw new ApiError("No se pudo abrir Wallet", response.status, "wallet_error");

      const payload = (await response.json()) as { url?: string };
      if (!payload.url) throw new ApiError("Save link no disponible", 500, "wallet_error");
      window.location.href = payload.url;
    } catch (error) {
      if (error instanceof ApiError && error.code === "rate_limited") {
        toast.error("Muchos intentos. Intenta en unos segundos.");
      } else {
        toast.error("Algo no salio bien. Reintenta.");
      }
    } finally {
      setIsOpeningWallet(false);
    }
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-3xl px-5 py-8">
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
          src="/frittes-logo.jpg"
          alt="Frittes Maison"
          className="h-24 w-auto object-contain"
          style={{ mixBlendMode: "multiply" }}
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
          className="text-xs font-medium text-ink-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
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
          {ready
            ? `Tienes ${account.stamps} sellos. Puedes canjear ${branding.rewardCopy}.`
            : `Te faltan ${account.threshold - account.stamps} sellos para ${branding.rewardCopy}.`}
        </p>
      </section>

      {/* PASE */}
      <WalletPass
        account={account}
        branding={branding}
        qrToken={qrToken}
        isQrExpired={isExpired}
        onRefreshQr={() => {
          setIsRefreshingQr(true);
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
            })
            .finally(() => setIsRefreshingQr(false));
        }}
      />
      <p className="mt-2 text-center text-[11px] text-ink-muted">
        QR {isExpired ? "expirado" : `vigente (${secondsLeft}s)`}
      </p>

      {/* ADD TO WALLET */}
      <section className="mx-auto mt-6 max-w-sm space-y-3">
        <p className="text-center text-[11px] font-semibold uppercase tracking-wider2 text-ink-muted">
          Llevalo siempre contigo
        </p>
        <AddToWallet
          disabled={isOpeningWallet || isRefreshingQr}
          onGoogleWallet={() => {
            void handleWallet();
          }}
        />
      </section>
      <InstallPrompt />

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
