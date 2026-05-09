import type { ReactNode } from "react";

import { FrittesMark } from "@/components/frittes-mark";

export default function LegalLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-5 py-8">
      <header className="mb-8 flex items-center gap-3 border-b border-line pb-4">
        <a href="/" className="inline-flex items-center gap-2 text-ink">
          <FrittesMark className="h-8 w-8" />
          <span className="font-display text-xl tracking-tight">Club Frittes</span>
        </a>
      </header>
      <article className="prose prose-neutral max-w-none text-ink">{children}</article>
    </main>
  );
}
