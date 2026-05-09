import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bodoni_Moda, Caveat, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

import { ToastProvider } from "@/components/toast";
import { branding, brandingToCssVars } from "@/lib/branding";

import "./globals.css";

// Bodoni Moda imita el "FRITTES" del logo (serif de alto contraste, moderno).
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

// Caveat imita el "maison" cursivo del logo.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-script",
  display: "swap",
});

// Plus Jakarta Sans para el body — limpio, moderno, sin caer en Inter.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${branding.programName} — Tarjeta de fidelidad`,
  description: branding.tagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Club Frittes",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: branding.brandColor,
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  const cssVars = brandingToCssVars() as React.CSSProperties;

  return (
    <html
      lang="es"
      className={`${bodoni.variable} ${caveat.variable} ${jakarta.variable}`}
      style={cssVars}
    >
      <body className="min-h-screen bg-cream text-ink bg-paper antialiased">
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        ) : null}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
