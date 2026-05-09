"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, type TransactionResult, accrue, redeem } from "@/lib/api";

type UiState = "scanner" | "customer-card" | "confirmation" | "error";

type CustomerCard = {
  name: string;
  balance: number;
  qrToken: string;
};

export default function PosHomePage(): JSX.Element {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [state, setState] = useState<UiState>("scanner");
  const [customer, setCustomer] = useState<CustomerCard | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("frittes-pos:session");
    if (!token) {
      router.replace("/login");
      return;
    }
    setSessionToken(token);
    try {
      const staff = JSON.parse(localStorage.getItem("frittes-pos:staff") ?? "{}") as {
        name?: string;
      };
      setStaffName(staff.name ?? "");
    } catch {
      // ignore
    }
  }, [router]);

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
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Use BarcodeDetector if available (Chrome/Android), else skip frame
        if ("BarcodeDetector" in window) {
          const detector = new (
            window as unknown as {
              BarcodeDetector: new (opts: {
                formats: string[];
              }) => { detect: (img: ImageData) => Promise<Array<{ rawValue: string }>> };
            }
          ).BarcodeDetector({ formats: ["qr_code"] });
          void detector.detect(imageData).then((codes) => {
            if (codes.length > 0 && !detectedRef.current) {
              detectedRef.current = true;
              stopCamera();
              onQrDetected(codes[0].rawValue);
            } else {
              rafRef.current = requestAnimationFrame(scan);
            }
          });
        } else {
          // Fallback: dynamic import jsqr
          void import("jsqr").then(({ default: jsQR }) => {
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && !detectedRef.current) {
              detectedRef.current = true;
              stopCamera();
              onQrDetected(code.data);
            } else {
              rafRef.current = requestAnimationFrame(scan);
            }
          });
        }
      };

      rafRef.current = requestAnimationFrame(scan);
    } catch {
      setErrorMsg("No se pudo acceder a la cámara.");
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  useEffect(() => {
    if (state === "scanner" && sessionToken) {
      void startCamera();
    }
    return () => {
      if (state !== "scanner") stopCamera();
    };
  }, [state, sessionToken, startCamera, stopCamera]);

  useEffect(() => {
    if (state !== "confirmation") return;
    const t = window.setTimeout(() => setState("scanner"), 3000);
    return () => window.clearTimeout(t);
  }, [state]);

  function onQrDetected(qrData: string): void {
    setCustomer({ name: "...", balance: 0, qrToken: qrData });
    setState("customer-card");
  }

  async function handleAccrue(): Promise<void> {
    if (!customer || !sessionToken) return;
    setActionLoading(true);
    try {
      const tx = await accrue(customer.qrToken, sessionToken);
      setResult(tx);
      setState("confirmation");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === "qr_expired"
            ? "QR expirado. Pide al cliente que refresque."
            : err.code === "qr_replayed"
              ? "QR ya usado. Pide un QR nuevo."
              : err.message
          : "Error al sumar sello.";
      setErrorMsg(msg);
      setState("error");
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
      setState("confirmation");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.code === "insufficient_stamps"
            ? "No tiene suficientes sellos para canjear."
            : err.code === "qr_expired"
              ? "QR expirado. Pide al cliente que refresque."
              : err.message
          : "Error al canjear premio.";
      setErrorMsg(msg);
      setState("error");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg px-5 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Frittes POS</h1>
          {staffName ? <p className="text-xs text-black/50">{staffName}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1 text-sm"
          onClick={() => {
            localStorage.removeItem("frittes-pos:session");
            localStorage.removeItem("frittes-pos:staff");
            router.push("/login");
          }}
        >
          Salir
        </button>
      </header>

      {state === "scanner" ? (
        <section className="space-y-3 rounded-xl border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Escanear QR del cliente</h2>
          <div className="relative overflow-hidden rounded-lg bg-black" style={{ aspectRatio: "1" }}>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-xl border-4 border-mustard opacity-70" />
            </div>
          </div>
          <p className="text-center text-sm text-black/50">Apunta la cámara al código QR del cliente</p>
        </section>
      ) : null}

      {state === "customer-card" && customer ? (
        <section className="space-y-4 rounded-xl border border-line bg-white p-4">
          <h2 className="text-lg font-semibold">Cliente detectado</h2>
          <p className="font-mono text-xs text-black/40 break-all">{customer.qrToken.slice(0, 40)}…</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={actionLoading}
              className="rounded-lg bg-forest px-4 py-4 text-lg font-bold text-white disabled:opacity-60"
              onClick={() => { void handleAccrue(); }}
            >
              {actionLoading ? "..." : "Sumar sello"}
            </button>
            <button
              type="button"
              disabled={actionLoading}
              className="rounded-lg bg-mustard px-4 py-4 text-lg font-bold text-ink disabled:opacity-60"
              onClick={() => { void handleRedeem(); }}
            >
              {actionLoading ? "..." : "Canjear premio"}
            </button>
          </div>
          <button
            type="button"
            className="w-full text-sm text-black/50 underline"
            onClick={() => setState("scanner")}
          >
            Cancelar — volver al scanner
          </button>
        </section>
      ) : null}

      {state === "confirmation" && result ? (
        <section className="rounded-xl border border-line bg-white p-6 text-center space-y-2">
          <p className="text-4xl">✓</p>
          <p className="text-xl font-semibold text-forest">
            {result.kind === "accrual" ? "Sello sumado" : "Premio canjeado"}
          </p>
          <p className="text-lg font-bold">{result.customer_name}</p>
          <p className="text-black/60">Saldo actual: {result.new_balance} sellos</p>
          <p className="mt-2 text-sm text-black/40">Volviendo al scanner en 3s...</p>
        </section>
      ) : null}

      {state === "error" ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <p className="text-xl font-semibold text-red-700">{errorMsg}</p>
          <button
            type="button"
            className="rounded-lg bg-ink px-6 py-2 text-white"
            onClick={() => setState("scanner")}
          >
            Volver al scanner
          </button>
        </section>
      ) : null}
    </main>
  );
}
