import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

export const metadata: Metadata = {
  title: "Frittes POS",
  description: "Panel de caja para Club Frittes Maison.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Frittes POS",
    statusBarStyle: "black-translucent",
  },
  icons: {
    shortcut: "/frittes-logo.png",
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1815",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="es">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
