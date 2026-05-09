"use client";

import { useCallback, useState } from "react";

import {
  ApiError,
  type LoyaltyCustomerDto,
  type OtpVerifyResponseDto,
  apiRequest,
} from "@/lib/api";
import { track } from "@/lib/analytics";

export type AuthStep =
  | "email-input"
  | "profile-input"
  | "authenticated"
  | "loading";

type UseAuthState = {
  step: AuthStep;
  email: string;
  customer: LoyaltyCustomerDto | null;
  error: ApiError | null;
};

type RegisterProfileInput = {
  customerName: string;
  email?: string;
};

const SESSION_KEY = "frittes-loyalty:session";

function saveSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, token);
}

export function useAuth(): {
  state: UseAuthState;
  submitEmail: (email: string) => Promise<void>;
  completeProfile: (input: RegisterProfileInput) => Promise<LoyaltyCustomerDto>;
  clearError: () => void;
} {
  const [state, setState] = useState<UseAuthState>({
    step: "email-input",
    email: "",
    customer: null,
    error: null,
  });

  const submitEmail = useCallback(async (email: string) => {
    setState((prev) => ({ ...prev, step: "loading", error: null }));
    try {
      const response = await apiRequest<OtpVerifyResponseDto>(
        "/loyalty/auth/email-login",
        { method: "POST", body: { email } },
      );
      saveSessionToken(response.session_token);
      track("signed_in");
      setState({
        step: "authenticated",
        email,
        customer: response.customer,
        error: null,
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "not_found") {
        setState({ step: "profile-input", email, customer: null, error: null });
        return;
      }
      setState({
        step: "email-input",
        email,
        customer: null,
        error:
          error instanceof ApiError
            ? error
            : new ApiError("No pudimos iniciar sesion", 0, "unknown"),
      });
    }
  }, []);

  const completeProfile = useCallback(
    async (input: RegisterProfileInput): Promise<LoyaltyCustomerDto> => {
      setState((prev) => ({ ...prev, step: "loading", error: null }));
      try {
        const email = (input.email ?? state.email).trim().toLowerCase();
        const response = await apiRequest<OtpVerifyResponseDto>(
          "/loyalty/customers",
          {
            method: "POST",
            body: {
              customer_name: input.customerName,
              phone: email,
              email,
            },
          },
        );
        saveSessionToken(response.session_token);
        track("signup_completed");

        const customer = response.customer!;
        setState({
          step: "authenticated",
          email,
          customer,
          error: null,
        });
        return customer;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          step: "profile-input",
          error:
            error instanceof ApiError
              ? error
              : new ApiError("No se pudo completar el perfil", 0, "unknown"),
        }));
        throw error;
      }
    },
    [state.email],
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { state, submitEmail, completeProfile, clearError };
}
