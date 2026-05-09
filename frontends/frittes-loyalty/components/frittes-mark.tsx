type FrittesMarkProps = {
  className?: string;
  /** Color de las papas. Default amarillo mostaza. */
  fillFries?: string;
  /** Color del cono y splashes. Default tinta. */
  fillInk?: string;
};

/**
 * Recreacion vectorial del logo de Frittes (cono de papas + splashes).
 * Inline SVG para que pueda heredar el color del tema y verse nitido en
 * cualquier tamaño. La forma orgnica esta dibujada a mano para mantener
 * el feel artesanal del original.
 */
export function FrittesMark({ className, fillFries, fillInk }: FrittesMarkProps): JSX.Element {
  const fries = fillFries ?? "var(--brand-mustard)";
  const ink = fillInk ?? "var(--brand-ink)";

  return (
    <svg viewBox="0 0 100 90" className={className} aria-hidden role="img">
      {/* Splashes / chispas arriba */}
      <g fill={ink}>
        <path d="M 32 6 Q 30 10 32 14 Q 34 11 32 6 Z" />
        <path d="M 50 2 Q 48 7 51 12 Q 53 8 50 2 Z" />
        <path d="M 68 8 Q 66 12 70 16 Q 71 12 68 8 Z" />
        <circle cx="40" cy="3" r="1.4" />
        <circle cx="60" cy="5" r="1.2" />
      </g>

      {/* Papas (5 papas dentro del cono) */}
      <g fill={fries} stroke={ink} strokeWidth="1.4" strokeLinejoin="round">
        <rect x="28" y="20" width="6" height="42" rx="1.5" />
        <rect x="36" y="14" width="6" height="48" rx="1.5" />
        <rect x="44" y="10" width="6" height="52" rx="1.5" />
        <rect x="52" y="14" width="6" height="48" rx="1.5" />
        <rect x="60" y="20" width="6" height="42" rx="1.5" />
      </g>

      {/* Cono / contenedor abajo */}
      <path
        d="M 22 48 L 78 48 L 68 86 Q 50 90 32 86 Z"
        fill="none"
        stroke={ink}
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Detalle decorativo del cono — pequenas marcas onduladas */}
      <path
        d="M 28 56 Q 32 58 36 56 M 40 60 Q 44 62 48 60 M 52 60 Q 56 62 60 60 M 64 56 Q 68 58 72 56"
        stroke={ink}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
