const DEFAULT_API_URL = "http://localhost:8000/api/v1";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "frittes-maison";

function getApiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (value?.trim()) return value.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return DEFAULT_API_URL;
  throw new Error("NEXT_PUBLIC_API_URL no configurada");
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string },
): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Restaurant-Id": RESTAURANT_ID,
  };
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      payload = undefined;
    }
    const code =
      typeof payload === "object" && payload && "code" in payload
        ? String((payload as { code?: unknown }).code ?? `http_${res.status}`)
        : `http_${res.status}`;
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message ?? "Error")
        : "Error";
    throw new ApiError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

export type StaffSession = {
  session_token: string;
  staff: { id: string; email: string; name: string; role: string };
};

export type TransactionResult = {
  kind: "accrual" | "redeem";
  new_balance: number;
  customer_name: string;
  reward_name?: string | null;
};

export function staffLogin(email: string, password: string): Promise<StaffSession> {
  return request<StaffSession>("/loyalty/staff/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function accrue(qrToken: string, sessionToken: string): Promise<TransactionResult> {
  return request<TransactionResult>("/loyalty/transactions/accrue", {
    method: "POST",
    body: { qr_token: qrToken },
    token: sessionToken,
  });
}

export function redeem(qrToken: string, sessionToken: string): Promise<TransactionResult> {
  return request<TransactionResult>("/loyalty/transactions/redeem", {
    method: "POST",
    body: { qr_token: qrToken },
    token: sessionToken,
  });
}

export type Proximity = {
  latitude: number | null;
  longitude: number | null;
  proximity_message: string | null;
};

export function getProximity(sessionToken: string): Promise<Proximity> {
  return request<Proximity>("/loyalty/admin/proximity", { token: sessionToken });
}

export function updateProximity(
  sessionToken: string,
  payload: Partial<Proximity> & { clear?: boolean },
): Promise<Proximity> {
  return request<Proximity>("/loyalty/admin/proximity", {
    method: "PATCH",
    body: payload,
    token: sessionToken,
  });
}

export type AnnounceStatus = {
  wallet_configured: boolean;
  sent_today: number;
  remaining_today: number;
  saved_passes: number | null;
};

export function getAnnounceStatus(sessionToken: string): Promise<AnnounceStatus> {
  return request<AnnounceStatus>("/loyalty/admin/announce", { token: sessionToken });
}

export function sendAnnounce(
  sessionToken: string,
  header: string,
  body: string,
): Promise<{ ok: boolean; remaining_today: number }> {
  return request<{ ok: boolean; remaining_today: number }>("/loyalty/admin/announce", {
    method: "POST",
    body: { header, body },
    token: sessionToken,
  });
}

// ─── Carta (menú) ─────────────────────────────────────────────────────────────

export type MenuItemData = {
  id: string | null;
  name: string;
  description: string | null;
  price_cents: number; // en Frittes: pesos CLP directos (sin centavos)
  is_available: boolean;
  badge: string | null;
  image_url: string | null;
};

export type MenuCategoryData = {
  id: string | null;
  name: string;
  items: MenuItemData[];
};

export type MenuData = {
  brand_name: string;
  categories: Array<MenuCategoryData & { position?: number }>;
};

export function getMenu(sessionToken: string): Promise<MenuData> {
  return request<MenuData>("/loyalty/admin/menu", { token: sessionToken });
}

export function saveMenu(
  sessionToken: string,
  categories: MenuCategoryData[],
): Promise<MenuData> {
  return request<MenuData>("/loyalty/admin/menu", {
    method: "PUT",
    body: { categories },
    token: sessionToken,
  });
}
