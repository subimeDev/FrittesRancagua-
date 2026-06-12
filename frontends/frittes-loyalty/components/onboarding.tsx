import { Gift, Smartphone, Stamp } from "lucide-react";

import type { FrittesBranding } from "@/lib/branding";

type OnboardingProps = {
  branding: FrittesBranding;
};

/**
 * Hero del flujo de registro/login.
 * El logo usa mix-blend-multiply para que su fondo blanco se funda con la
 * tarjeta crema (sin recuadro). Las stat-pills usan iconos lucide en vez de
 * emojis para mantener el bar visual del resto de la app.
 */
export function Onboarding({ branding }: OnboardingProps): JSX.Element {
  return (
    <div className="rounded-pass border border-line bg-cream-elev px-6 pb-7 pt-8 text-center shadow-card">
      {/* Versión del logo sin fondo (el .jpg original trae recuadro blanco) */}
      <img
        src="/frittes-logo-trans.png"
        alt={branding.name}
        className="mx-auto h-36 w-auto object-contain"
      />
      <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-relaxed text-ink-muted">
        {branding.tagline}
      </p>

      {/* Stat pills */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <StatPill
          icon={<Stamp className="h-4 w-4" strokeWidth={2} />}
          number={String(branding.rewardThreshold)}
          label="sellos"
        />
        <StatPill
          icon={<Gift className="h-4 w-4" strokeWidth={2} />}
          number="1"
          label="premio"
        />
        <StatPill
          icon={<Smartphone className="h-4 w-4" strokeWidth={2} />}
          number="0"
          label="apps"
        />
      </div>
      <p className="mt-3 text-[11px] text-ink-muted">
        Sin apps que descargar — tu pase vive en el navegador.
      </p>
    </div>
  );
}

function StatPill({
  icon,
  number,
  label,
}: {
  icon: JSX.Element;
  number: string;
  label: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-xl border border-line/60 bg-cream-muted px-2 py-3">
      <span className="mb-1 text-mustard-deep">{icon}</span>
      <span className="font-display text-2xl font-bold leading-tight text-ink">{number}</span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
        {label}
      </span>
    </div>
  );
}
