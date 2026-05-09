import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Frittes POS",
  description: "Escaner de caja para Club Frittes",
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
