"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

/**
 * Generador del QR de la carta. El QR apunta a la carta pública (no cambia
 * aunque se edite el menú). Permite descargar un PNG de alta resolución y
 * un cartelito de mesa listo para imprimir.
 */

const MENU_URL = "https://frittes2026.cl/menu";

export default function CartaQrPage(): JSX.Element {
  const router = useRouter();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void QRCode.toDataURL(MENU_URL, {
      width: 1000,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#1A1815", light: "#ffffff" },
    }).then(setDataUrl);
  }, []);

  function downloadPng(): void {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "qr-carta-frittes.png";
    a.click();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8" style={{ background: "#F5F1E8", color: "#1A1815" }}>
      <header className="mb-5 print:hidden">
        <button
          type="button"
          onClick={() => router.push("/admin?tab=carta")}
          className="mb-3 text-xs font-medium"
          style={{ color: "#6B6660" }}
        >
          ← Volver al panel
        </button>
        <h1 className="text-2xl font-black">QR de la carta</h1>
        <p className="mt-1 text-xs" style={{ color: "#6B6660" }}>
          Pega este código en cada mesa. Tus clientes lo escanean y ven la carta.
          El QR no cambia aunque edites platos o precios.
        </p>
      </header>

      {/* Cartelito de mesa (lo que se imprime) */}
      <div
        ref={cardRef}
        className="mx-auto rounded-3xl border-2 px-6 py-8 text-center"
        style={{ borderColor: "#1A1815", background: "#FFFFFF", maxWidth: 360 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/frittes-logo-trans.png" alt="Frittes Maison" className="mx-auto h-20 w-auto object-contain" />
        <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em]" style={{ color: "#6B6660" }}>
          Nuestra carta
        </p>
        <div className="mx-auto mt-4 w-56">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR de la carta" className="w-full" />
          ) : (
            <div className="aspect-square w-full animate-pulse rounded-xl" style={{ background: "#EDE8DB" }} />
          )}
        </div>
        <p className="mt-4 text-base font-black">Escanea y mira la carta 🍟</p>
        <p className="mt-1 text-xs" style={{ color: "#6B6660" }}>
          Apunta la cámara de tu celular al código
        </p>
        <div className="mt-4 rounded-full px-4 py-1.5 text-xs font-bold" style={{ background: "#FFD23F", color: "#1A1815", display: "inline-block" }}>
          frittes2026.cl/menu
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-6 space-y-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[48px] w-full rounded-xl text-sm font-bold"
          style={{ background: "#1A1815", color: "#FFD23F" }}
        >
          🖨️ Imprimir cartelito de mesa
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={!dataUrl}
          className="min-h-[48px] w-full rounded-xl border text-sm font-semibold disabled:opacity-60"
          style={{ borderColor: "#E2DCCC", color: "#1A1815" }}
        >
          ⬇️ Descargar solo el QR (PNG)
        </button>
      </div>
    </main>
  );
}
