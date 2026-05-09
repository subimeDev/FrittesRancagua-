"use client";

import { useCallback, useMemo, useState } from "react";

import {
  ApiError,
  type LoyaltyCustomerDto,
  type OtpVerifyResponseDto,
  apiRequest,
} from "@/lib/api";
import { track } from "@/lib/analytics";

export type AuthStep =
  | "phone-input"
  | "code-input"
  | "profile-input"
  | "authenticated"
  | "loading";

type UseAuthState = {
  step: AuthStep;
  phone: string;
  token: string | null;
  customer: LoyaltyCustomerDto | null;
  error: ApiError | null;
  resendAt: number | null;
};

type RegisterProfileInput = {
  customerName: string;
  email?: string;
};

/**
 * TODO backend loyalty auth:
 * - POST /api/v1/loyalty/auth/request-otp { phone } -> 204
 * - POST /api/v1/loyalty/auth/verify-otp { phone, code } -> { session_token, customer }
 */
export function useAuth(): {
  state: UseAuthState;
  resendSecondsLeft: number;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  completeProfile: (input: RegisterProfileInput) => Promise<LoyaltyCustomerDto>;
  clearError: () => void;
} {
  const [state, setState] = useState<UseAuthState>({
    step: "phone-input",
    phone: "",
    token: null,
    customer: null,
    error: null,
    resendAt: null,
  });

  const resendSecondsLeft = useMemo(() => {
    if (!state.resendAt) return 0;
    const seconds = Math.ceil((state.resendAt - Date.now()) / 1000);
    return Math.max(seconds, 0);
  }, [state.resendAt]);

  const requestOtp = useCallback(async (phone: string) => {
    setState((prev) => ({ ...prev, step: "loading", error: null }));
    try {
      await apiRequest<void>("/loyalty/auth/request-otp", {
        method: "POST",
        body: { phone },
      });
      track("otp_requested");
      setState((prev) => ({
        ...prev,
        phone,
        step: "code-input",
        resendAt: Date.now() + 30_000,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: "phone-input",
        error: error instanceof ApiError ? error : new ApiError("Error al enviar codigo", 0, "unknown"),
      }));
    }
  }, []);

  const verifyOtp = useCallback(
    async (code: string) => {
      setState((prev) => ({ ...prev, step: "loading", error: null }));
      try {
        const response = await apiRequest<OtpVerifyResponseDto>("/loyalty/auth/verify-otp", {
          method: "POST",
          body: { phone: state.phone, code },
        });

        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: response.session_token }),
        });

        track("otp_verified");
        setState((prev) => ({
          ...prev,
          token: response.session_token,
          customer: response.customer,
          step: response.customer ? "authenticated" : "profile-input",
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          step: "code-input",
          error: error instanceof ApiError ? error : new ApiError("Codigo invalido", 0, "invalid_code"),
        }));
      }
    },
    [state.phone],
  );

  const completeProfile = useCallback(
    async (input: RegisterProfileInput): Promise<LoyaltyCustomerDto> => {
      setState((prev) => ({ ...prev, step: "loading", error: null }));
      try {
        const customer = await apiRequest<LoyaltyCustomerDto>("/loyalty/customers", {
          method: "POST",
          token: state.token ?? undefined,
          body: {
            customer_name: input.customerName,
            email: input.email || undefined,
          },
        });
        track("signup_completed");

        setState((prev) => ({
          ...prev,
          customer,
          step: "authenticated",
          error: null,
        }));
        return customer;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          step: "profile-input",
          error:
            error instanceof ApiError ? error : new ApiError("No se pudo completar el perfil", 0, "unknown"),
        }));
        throw error;
      }
    },
    [state.token],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { state, resendSecondsLeft, requestOtp, verifyOtp, completeProfile, clearError };
}
