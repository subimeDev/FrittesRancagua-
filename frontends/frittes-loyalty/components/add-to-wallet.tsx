"use client";

type AddToWalletProps = {
  onGoogleWallet?: () => void;
  disabled?: boolean;
};

export function AddToWallet({ onGoogleWallet, disabled }: AddToWalletProps): JSX.Element {
  return (
    <div className="flex justify-center">
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
