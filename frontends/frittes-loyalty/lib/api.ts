const DEFAULT_API_URL = "http://localhost:8000/api/v1";
const DEFAULT_RESTAURANT_ID = "frittes-maison";

function getApiUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (value?.trim()) return value.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return DEFAULT_API_URL;
  throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
}

function getRestaurantId(): string {
  return process.env.NEXT_PUBLIC_RESTAURANT_ID?.trim() || DEFAULT_RESTAURANT_ID;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const url = `${getApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const method = options.method ?? "GET";
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-Restaurant-Id": getRestaurantId(),
  });

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const retries = [200, 600, 1800];
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries.length; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        cache: "no-store",
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }

        const payloadCode =
          typeof payload === "object" && payload && "code" in payload
            ? String((payload as { code?: unknown }).code ?? "")
            : "";

        const code =
          response.status === 401
            ? "unauthenticated"
            : response.status === 429
              ? "rate_limited"
            : payloadCode || (response.status === 404 ? "not_found" : `http_${response.status}`);

        const message =
          typeof payload === "object" && payload && "message" in payload
            ? String((payload as { message?: unknown }).message ?? "Request failed")
            : "Request failed";

        const apiError = new ApiError(message, response.status, code, payload);
        if (response.status >= 500 && attempt < retries.length) {
          await delay(retries[attempt]);
          continue;
        }
        throw apiError;
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) throw error;
      if (attempt < retries.length) {
        await delay(retries[attempt]);
        continue;
      }
    }
  }

  throw new ApiError("Network error", 0, "network_error", lastError);
}

export type RewardTierDto = {
  stamps_required: number;
  reward_name: string;
};

export type LoyaltyCustomerDto = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  stamps: number;
  threshold: number;
  lifetime_stamps: number;
  redemptions: number;
  tier: string;
  member_since: string;
  /** stamps_required of the milestones already claimed in the current card cycle. */
  redeemed_tiers?: number[];
};

export type ProgramConfigDto = {
  threshold: number;
  reward_name: string;
  tier_name: string;
  tiers: RewardTierDto[];
};

export type RegisterDto = {
  customer_name: string;
  email?: string;
};

export type OtpRequestDto = {
  phone: string;
};

export type OtpVerifyDto = {
  phone: string;
  code: string;
};

export type OtpVerifyResponseDto = {
  session_token: string;
  customer: LoyaltyCustomerDto | null;
};

export type QrTokenDto = {
  token: string;
  exp_at: string;
};
