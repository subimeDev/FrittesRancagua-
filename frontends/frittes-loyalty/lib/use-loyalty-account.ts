"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, type LoyaltyCustomerDto, apiRequest } from "@/lib/api";

type State =
  | { status: "loading"; account: null; isStale: boolean; reason?: string }
  | { status: "unauthenticated"; account: null; isStale: boolean; reason?: string }
  | { status: "authenticated"; account: LoyaltyCustomerDto; isStale: boolean; reason?: string };

const SESSION_KEY = "frittes-loyalty:session";

function readSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

function saveSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, token);
}

function clearSessionToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function useLoyaltyAccount(
  slug: string,
): {
  state: State;
  sessionToken: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  void slug;
  const [state, setState] = useState<State>({
    status: "loading",
    account: null,
    isStale: false,
    reason: undefined,
  });
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sessionToken = readSessionToken();
    setToken(sessionToken);
    if (!sessionToken) {
      setState({ status: "unauthenticated", account: null, isStale: false, reason: undefined });
      return;
    }
    try {
      const account = await apiRequest<LoyaltyCustomerDto>("/loyalty/customers/me", { token: sessionToken });
      setState({ status: "authenticated", account, isStale: false });
    } catch (error) {
      if (error instanceof ApiError && error.code === "unauthenticated") {
        clearSessionToken();
        setToken(null);
        setState({ status: "unauthenticated", account: null, isStale: false, reason: undefined });
        return;
      }
      if (error instanceof ApiError && error.code === "not_found") {
        clearSessionToken();
        setToken(null);
        setState({ status: "unauthenticated", account: null, isStale: false, reason: "not_found" });
        return;
      }
      setState((prev) => {
        if (prev.status === "authenticated") return { ...prev, isStale: true };
        return { status: "unauthenticated", account: null, isStale: false, reason: undefined };
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    if (document.visibilityState !== "visible") return;
    // 5 s para que los sellos aparezcan casi en tiempo real tras el escaneo del cajero
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [state.status, refresh]);

  useEffect(() => {
    function handleVisibility(): void {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      if (token) {
        await apiRequest<void>("/loyalty/auth/sign-out", { method: "POST", token });
      }
    } finally {
      clearSessionToken();
      setToken(null);
      setState({ status: "unauthenticated", account: null, isStale: false, reason: undefined });
    }
  }, [token]);

  return { state, sessionToken: token, refresh, signOut };
}
