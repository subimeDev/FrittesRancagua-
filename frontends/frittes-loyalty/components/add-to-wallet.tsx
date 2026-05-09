"use client";

type AddToWalletProps = {
  /** Callback al hacer tap. En produccion: redirige al .pkpass / save link. */
  onAppleWallet?: () => void;
  onGoogleWallet?: () => void;
  disabled?: boolean;
};

/**
 * Botones de "Añadir a Wallet" estilizados al espec oficial de cada plataforma.
 *
 * Apple Wallet: pill negro, logo + texto blanco, esquinas pronunciadas.
 * Google Wallet: pill negro con borde sutil, logo multicolor + texto.
 *
 * En produccion conectar:
 *  - Apple: descargar .pkpass firmado desde el backend (`GET /api/v1/passes/apple/{id}`)
 *  - Google: redirigir al "Save to Google Wallet" link generado server-side
 */
export function AddToWallet({ onAppleWallet, onGoogleWallet, disabled }: AddToWalletProps): JSX.Element {
  return (
    <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center">
      <button
        type="button"
        disabled={disabled}
        onClick={onAppleWallet}
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#000] px-5 py-3 text-white shadow-card transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <AppleLogo />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/75">
            Añadir a
          </span>
          <span className="text-base font-semibold tracking-tight">Apple Wallet</span>
        </span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={onGoogleWallet}
        className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#000] px-5 py-3 text-white shadow-card transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleWalletLogo />
        <span className="flex flex-col items-start leading-none">
          <span className="text-[9px] font-medium uppercase tracking-wider text-white/75">
            Guardar en
          </span>
          <span className="text-base font-semibold tracking-tight">Google Wallet</span>
        </span>
      </button>
    </div>
  );
}

function AppleLogo(): JSX.Element {
  return (
    <svg width="22" height="26" viewBox="0 0 24 28" fill="white" aria-hidden>
      <path d="M19.5 21.4c-1.1 1.6-2.3 3.1-4 3.2-1.7.1-2.3-1-4.3-1s-2.7 1-4.3 1c-1.7 0-3-1.7-4-3.2-2.2-3-3.8-8.6-1.6-12.4 1.1-1.9 3-3.1 5-3.1 1.7 0 3.2 1.1 4.3 1.1 1 0 2.9-1.4 4.9-1.2.8 0 3.2.3 4.7 2.5-3.8 2.4-3.2 7.7.5 9.4-.5 1.4-1.1 2.6-1.2 2.7zM14.5 4.6c.9-1 1.5-2.5 1.3-3.9-1.2.1-2.7.8-3.6 1.8-.8.9-1.5 2.4-1.3 3.8 1.4.1 2.7-.7 3.6-1.7z" />
    </svg>
  );
}

function GoogleWalletLogo(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M21 8c0-1.1-.9-2-2-2h-4l-2-3H6C4.9 3 4 3.9 4 5v6h17V8z"
        fill="#4285F4"
      />
      <path d="M4 11v8c0 1.1.9 2 2 2h13c1.1 0 2-.9 2-2v-8H4z" fill="#34A853" />
      <circle cx="13" cy="15" r="2" fill="#FBBC05" />
      <circle cx="16" cy="15" r="2" fill="#EA4335" opacity="0.85" />
    </svg>
  );
}
