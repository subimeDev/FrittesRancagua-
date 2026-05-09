export type LoyaltyAccount = {
  id: string;
  customerName: string;
  phone: string;
  email?: string;
  /** Sellos vigentes (se reinicia al canjear). */
  stamps: number;
  /** Cuantos sellos completa una recompensa. */
  threshold: number;
  /** Sellos historicos acumulados desde el alta (no se reinician). */
  lifetimeStamps: number;
  /** Cantidad de canjes realizados. */
  redemptions: number;
  tier: string;
  /** ISO date string del alta. */
  memberSince: string;
};

export type RegisterInput = {
  customerName: string;
  phone: string;
  email?: string;
};
