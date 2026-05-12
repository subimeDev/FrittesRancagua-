import type { FrittesBranding } from "@/lib/branding";

type OnboardingProps = {
  branding: FrittesBranding;
};

/**
 * Hero del flujo de registro/login.
 * Reemplaza la lista de 4 perks por 3 stat-pills mas visuales.
 */
export function Onboarding({ branding }: OnboardingProps): JSX.Element {
  return (
    <div className="rounded-pass bg-cream-elev px-6 py-8 shadow-card text-center">
      <img
        src={branding.logoSrc}
        alt={branding.name}
        className="mx-auto h-48 w-auto object-contain"
        style={{ mixBlendMode: "multiply" }}
      />
      <p className="mt-2 text-sm text-ink-muted">{branding.tagline}</p>

      {/* Stat pills */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        <StatPill number={String(branding.rewardThreshold)} label="sellos" />
        <StatPill number="1" label="premio" />
        <StatPill number="📱" label="gratis" isEmoji />
      </div>
    </div>
  );
}

function StatPill({
  number,
  label,
  isEmoji = false,
}: {
  number: string;
  label: string;
  isEmoji?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center rounded-xl bg-cream-muted px-2 py-3">
      <span
        className={
          isEmoji
            ? "text-2xl leading-tight"
            : "font-display text-2xl font-bold leading-tight text-ink"
        }
      >
        {number}
      </span>
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider2 text-ink-muted">
        {label}
      </span>
    </div>
  );
}
