"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type TransactionResult, accrue, redeem } from "@/lib/api";

type UiState = "auth-check" | "dashboard" | "scanner" | "customer-card" | "confirmation" | "error";

type Staff = { id: string; email: string; name: string; role: string };

type CustomerCard = {
  qrToken: string;
};

export default function PosHomePage(): JSX.Element {
  const router = useRouter();
  const [uiState, setUiState] = useState<UiState>("auth-check");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [customer, setCustomer] = useState<CustomerCard | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);

  // Auth check on mount
  useEffect(() => {
    const token = localStorage.getItem("frittes-pos:session");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const staffData = JSON.parse(
        localStorage.getItem("frittes-pos:staff") ?? "null",
      ) as Staff | null;
      setSessionToken(token);
      setStaff(staffData);
      setUiState("dashboard");
    } catch {
      router.replace("/login");
    }
  }, [router]);

  // Auto-return after confirmation
  useEffect(() => {
    if (uiState !== "confirmation") return;
    const t = window.setTimeout(() => setUiState("dashboard"), 3000);
    return () => window.clearTimeout(t);
  }, [uiState]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectedRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    detectedRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      // Create detector once — reusing it every frame is much more reliable.
      type BD = { detect: (src: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> };
      const detector: BD | null = "BarcodeDetector" in window
        ? new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => BD })
            .BarcodeDetector({ formats: ["qr_code"] })
        : null;

      // jsQR is loaded once on first non-native frame.
      let jsQRMod: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;

      const scan = (): void => {
        if (detectedRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas || !video.videoWidth) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        if (detector) {
          // Pass canvas element — BarcodeDetector works best with ImageBitmapSource elements.
          void detector.detect(canvas).then((codes) => {
            if (codes.length > 0 && !detectedRef.current) {
              detectedRef.current = true;
              stopCamera();
              onQrDetected(codes[0].rawValue);
            } else {
              rafRef.current = requestAnimationFrame(scan);
            }
          }).catch(() => {
            rafRef.current = requestAnimationFrame(scan);
          });
        } else {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const runJsQR = (fn: typeof jsQRMod): void => {
            if (!fn) { rafRef.current = requestAnimationFrame(scan); return; }
            const code = fn(imageData.data, imageData.width, imageData.height);
            if (code && !detectedRef.current) {
              detectedRef.current = true;
              stopCamera();
              onQrDetected(code.data);
            } else {
              rafRef.current = requestAnimationFrame(scan);
            }
          };
          if (jsQRMod) {
            runJsQR(jsQRMod);
          } else {
            void import("jsqr").then(({ default: jsQR }) => {
              jsQRMod = jsQR;
              runJsQR(jsQR);
            });
          }
        }
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      setErrorMsg("No se pudo acceder a la cámara. Verifica los permisos.");
      setUiState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  // Stop camera when leaving scanner
  useEffect(() => {
    if (uiState !== "scanner") stopCamera();
  }, [uiState, stopCamera]);

  function onQrDetected(qrData: string): void {
    setCustomer({ qrToken: qrData });
    setUiState("customer-card");
  }

  function handleSignOut(): void {
    stopCamera();
    localStorage.removeItem("frittes-pos:session");
    localStorage.removeItem("frittes-pos:staff");
    router.push("/login");
  }

  function handleApiError(err: unknown, fallback: string): string {
    if (!(err instanceof ApiError)) return fallback;
    if (err.status === 401) return "Sesión expirada. Vuelve a iniciar sesión.";
    if (err.code === "qr_expired") return "QR expirado. Pide al cliente que refresque su app.";
    if (err.code === "qr_replayed") return "QR ya usado. Pide al cliente un nuevo QR.";
    if (err.code === "qr_invalid") return "QR inválido. Pide al cliente que refresque su app.";
    if (err.code === "insufficient_stamps") return "El cliente no tiene suficientes sellos para canjear.";
    return err.message || fallback;
  }

  async function handleAccrue(): Promise<void> {
    if (!customer || !sessionToken) return;
    setActionLoading(true);
    try {
      const tx = await accrue(customer.qrToken, sessionToken);
      setResult(tx);
      setUiState("confirmation");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleSignOut();
        return;
      }
      setErrorMsg(handleApiError(err, "Error al sumar sello."));
      setUiState("error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRedeem(): Promise<void> {
    if (!customer || !sessionToken) return;
    setActionLoading(true);
    try {
      const tx = await redeem(customer.qrToken, sessionToken);
      setResult(tx);
      setUiState("confirmation");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        handleSignOut();
        return;
      }
      setErrorMsg(handleApiError(err, "Error al canjear premio."));
      setUiState("error");
    } finally {
      setActionLoading(false);
    }
  }

  if (uiState === "auth-check") {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm text-black/40">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-cream px-5 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/frittes-logo.jpg"
            alt="Frittes Maison"
            className="h-12 w-auto object-contain"
          />
          <div className="border-l border-line pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">
              POS · {staff?.role === "manager" ? "Admin" : "Cajero"}
            </p>
            {staff ? (
              <p className="text-sm font-bold text-ink">{staff.name}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-black/70 hover:bg-gray-50"
        >
          Salir
        </button>
      </header>

      {/* Dashboard */}
      {uiState === "dashboard" ? (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setUiState("scanner");
              void startCamera();
            }}
            className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-ink px-6 py-6 text-left text-white shadow-card active:scale-[0.98] transition-transform"
          >
            <span className="grid h-14 w-14 flex-none place-items-center rounded-xl bg-mustard text-ink text-2xl">
              📷
            </span>
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                Acción principal
              </p>
              <p className="text-xl font-bold leading-tight">Escanear QR del cliente</p>
              <p className="mt-0.5 text-xs text-white/70">Sumar sello o canjear premio</p>
            </div>
            <span className="text-2xl text-white/40 group-active:translate-x-1 transition-transform">›</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => router.push("/admin?tab=customers&with_coupon=1")}
              className="rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">🎟️</span>
              <p className="mt-1.5 text-sm font-bold text-ink">Cupones</p>
              <p className="text-[11px] text-black/50">Clientes con premio listo</p>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin?tab=customers")}
              className="rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">👥</span>
              <p className="mt-1.5 text-sm font-bold text-ink">Clientes</p>
              <p className="text-[11px] text-black/50">Buscar y ver historial</p>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin?tab=transactions")}
              className="rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">📊</span>
              <p className="mt-1.5 text-sm font-bold text-ink">Movimientos</p>
              <p className="text-[11px] text-black/50">Sellos y canjes recientes</p>
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin?tab=stats")}
              className="rounded-2xl border border-line bg-white px-4 py-4 text-left shadow-sm active:scale-95 transition-transform"
            >
              <span className="text-2xl">📈</span>
              <p className="mt-1.5 text-sm font-bold text-ink">Resumen</p>
              <p className="text-[11px] text-black/50">Stats del programa</p>
            </button>
          </div>

          {staff?.role === "manager" ? (
            <button
              type="button"
              onClick={() => router.push("/admin?tab=staff")}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm active:scale-95 transition-transform"
            >
              <span className="flex items-center gap-2.5">
                <span className="text-lg">⚙️</span>
                Gestionar cajeros
              </span>
              <span className="text-black/30">›</span>
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Scanner */}
      {uiState === "scanner" ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUiState("dashboard")}
              className="text-sm text-black/50 underline"
            >
              ← Volver
            </button>
            <p className="text-sm font-semibold text-ink">Escanear QR</p>
          </div>
          <div
            className="relative overflow-hidden rounded-2xl bg-black"
            style={{ aspectRatio: "1" }}
          >
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {/* Viewfinder overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-52 w-52">
                <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-mustard" />
                <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-mustard" />
                <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-mustard" />
                <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-mustard" />
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-black/50">
            Apunta la cámara al código QR del cliente
          </p>
        </section>
      ) : null}

      {/* Customer Card */}
      {uiState === "customer-card" && customer ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUiState("scanner");
                void startCamera();
              }}
              className="text-sm text-black/50 underline"
            >
              ← Volver a escanear
            </button>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-black/40">
              Cliente verificado
            </p>
            <p className="mt-1 text-sm font-mono text-black/30 break-all">
              {customer.qrToken.slice(0, 48)}…
            </p>
          </div>
          <p className="text-center text-sm font-medium text-black/60">
            Selecciona la acción a realizar:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => { void handleAccrue(); }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-forest px-4 py-6 font-bold text-white shadow-sm active:scale-95 transition-transform disabled:opacity-60"
            >
              <span className="text-3xl">⭐</span>
              <span className="text-lg">Sumar sello</span>
            </button>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => { void handleRedeem(); }}
              className="flex flex-col items-center gap-2 rounded-2xl bg-mustard px-4 py-6 font-bold text-ink shadow-sm active:scale-95 transition-transform disabled:opacity-60"
            >
              <span className="text-3xl">🎁</span>
              <span className="text-lg">Canjear premio</span>
            </button>
          </div>
          {actionLoading ? (
            <p className="text-center text-sm text-black/50">Procesando...</p>
          ) : null}
        </section>
      ) : null}

      {/* Confirmation */}
      {uiState === "confirmation" && result ? (
        <section className="rounded-2xl border border-line bg-white p-8 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-3xl">✓</span>
          </div>
          <p className="text-xl font-bold text-ink">
            {result.kind === "accrual" ? "¡Sello sumado!" : "¡Premio canjeado!"}
          </p>
          <p className="text-2xl font-bold text-forest">{result.customer_name}</p>
          <div className="rounded-xl bg-cream px-4 py-3">
            <p className="text-sm text-black/50">Saldo actual</p>
            <p className="text-3xl font-bold text-ink">{result.new_balance} sellos</p>
          </div>
          <p className="text-xs text-black/30">Volviendo al panel en 3s...</p>
        </section>
      ) : null}

      {/* Error */}
      {uiState === "error" ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-3xl">✕</span>
          </div>
          <p className="text-lg font-semibold text-red-700">{errorMsg}</p>
          <button
            type="button"
            className="rounded-xl bg-ink px-8 py-3 font-semibold text-white"
            onClick={() => setUiState("dashboard")}
          >
            Volver al panel
          </button>
        </section>
      ) : null}
    </main>
  );
}
