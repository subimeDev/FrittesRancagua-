/**
 * Branding de Frittes Maison — extraido del menu impreso 2026 y del logo.
 *
 * Identidad:
 *  - Negro denso para tipografia (`ink`)
 *  - Amarillo mostaza Frittes para acento (`mustard`)
 *  - Crema papel rugoso para fondo (`cream`)
 *  - Verde bosque para Breadgan vegan (`forest`)
 *
 * Para reutilizar este proyecto con otro restaurante, editar `branding`
 * (todos los componentes leen colores via CSS vars y datos via prop).
 */

export type FrittesBranding = {
  slug: string;
  name: string;
  /** Texto bajo el wordmark, usado tambien en cursiva. */
  subtitle: string;
  /** Nombre del programa de fidelidad. */
  programName: string;
  /** Etiqueta del balance: "sellos", "puntos", "estrellas". */
  pointsLabel: string;
  /** Como se llama un cliente: "miembro", "amigo", "cliente". */
  memberLabel: string;
  defaultTier: string;
  /** Cuantos sellos para canjear el premio principal. */
  rewardThreshold: number;
  /** Que se gana al llegar al threshold. */
  rewardCopy: string;
  /** Tagline del hero. */
  tagline: string;
  /** Beneficios resumidos para el onboarding. */
  perks: { icon: string; text: string }[];
  /** Url al logo. */
  logoSrc: string;
  /** Color de la mostaza, expuesto crudo para SVGs / wallet meta. */
  brandColor: string;
  contact: {
    whatsappPhone: string;
    instagram: string;
  };
  currency: {
    code: string;
    locale: string;
    fractionDigits: number;
  };
};

export const branding: FrittesBranding = {
  slug: "frittes-maison",
  name: "Frittes",
  subtitle: "maison",
  programName: "Club Frittes",
  pointsLabel: "sellos",
  memberLabel: "miembro",
  defaultTier: "Maisonero",
  rewardThreshold: 10,
  rewardCopy: "Papas L gratis",
  tagline: "Junta sellos en cada visita y canjea papas, hot dogs y mas.",
  perks: [
    { icon: "🍟", text: "1 sello por cada pedido sobre $5.000" },
    { icon: "🎁", text: "Premio cada 10 sellos completados" },
    { icon: "📱", text: "Tu pase vive en tu Wallet, sin app extra" },
    { icon: "🚀", text: "Validacion al toque con el QR" },
  ],
  logoSrc: "/frittes-logo.jpg",
  brandColor: "#FFD23F",
  contact: {
    whatsappPhone: "+56935204723",
    instagram: "@frittes.maison.oficial",
  },
  currency: {
    code: "CLP",
    locale: "es-CL",
    fractionDigits: 0,
  },
};

/**
 * Convierte el branding a CSS variables para inyectar en `<html style>`.
 */
export function brandingToCssVars(): Record<string, string> {
  return {
    "--brand-ink": "#1A1815",
    "--brand-ink-muted": "#6B6660",
    "--brand-cream": "#F5F1E8",
    "--brand-cream-elev": "#FBF8F1",
    "--brand-cream-muted": "#EDE8DB",
    "--brand-mustard": "#FFD23F",
    "--brand-mustard-deep": "#E8B82E",
    "--brand-forest": "#2D5A3F",
    "--brand-ember": "#E55934",
    "--brand-line": "#E2DCCC",
  };
}

export function whatsappUrl(phone: string, message?: string): string {
  const sanitized = phone.replace(/[^0-9]/g, "");
  const params = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${sanitized}${params}`;
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "")}`;
}
