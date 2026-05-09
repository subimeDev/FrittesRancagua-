declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, unknown> }) => void;
  }
}

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) return;
  window.plausible?.(event, props ? { props } : undefined);
}
