export function SkeletonPass(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-pass shadow-pass" style={{ background: "var(--brand-cream-elev)" }}>
      {/* Header simulado — misma altura que el header del pase real */}
      <div
        className="h-[110px] animate-pulse"
        style={{ background: "var(--brand-mustard)" }}
      />

      {/* Body — nombre, tier badge, contador de sellos, barra */}
      <div className="space-y-3 px-6 py-5">
        <div className="h-2.5 w-16 animate-pulse rounded-full bg-cream-muted" />
        <div className="h-7 w-44 animate-pulse rounded-lg bg-cream-muted" />
        <div className="h-5 w-20 animate-pulse rounded-full bg-cream-muted" />
        <div className="mt-5 h-14 w-36 animate-pulse rounded-xl bg-cream-muted" />
        <div className="h-2.5 w-full animate-pulse rounded-full bg-cream-muted" />
      </div>

      {/* Strip QR — fila icono + datos */}
      <div
        className="flex items-center gap-3 border-t border-line px-5 py-4"
        style={{ background: "var(--brand-cream-muted)" }}
      >
        <div className="h-[108px] w-[108px] flex-none animate-pulse rounded-xl bg-cream" />
        <div className="flex-1 space-y-2">
          <div className="h-2 w-14 animate-pulse rounded bg-cream" />
          <div className="h-4 w-20 animate-pulse rounded bg-cream" />
          <div className="h-2 w-16 animate-pulse rounded bg-cream" />
          <div className="mt-2 h-5 w-20 animate-pulse rounded-full bg-cream" />
        </div>
      </div>
    </div>
  );
}
