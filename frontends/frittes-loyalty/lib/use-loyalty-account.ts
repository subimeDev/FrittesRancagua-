"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, type LoyaltyCustomerDto, apiRequest } from "@/lib/api";

type State =
  | { status: "loading"; account: null; isStale: boolean; reason?: string }
  | { status: "unauthenticated"; account: null; isStale: boolean; reason?: string }
  | { status: "authenticated"; account: LoyaltyCustomerDto; isStale: boolean; reason?: string };

async function readSessionToken(): Promise<string | null> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  if (!response.ok) return null;
  const payload = (await response.json()) as { token?: string | null };
  return payload.token ?? null;
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
    const sessionToken = await readSessionToken();
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
        setState({ status: "unauthenticated", account: null, isStale: false, reason: undefined });
        return;
      }
      if (error instanceof ApiError && error.code === "not_found") {
        await fetch("/api/auth/session", { method: "DELETE" });
        setToken(null);
        setState({
          status: "unauthenticated",
          account: null,
          isStale: false,
          reason: "not_found",
        });
        return;
      }
      setState((prev) => {
        if (prev.status === "authenticated") {
          return { ...prev, isStale: true };
        }
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
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 30_000);
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
        await apiRequest<void>("/loyalty/auth/sign-out", {
          method: "POST",
          token,
        });
      }
    } finally {
      await fetch("/api/auth/session", { method: "DELETE" });
      setToken(null);
      setState({ status: "unauthenticated", account: null, isStale: false, reason: undefined });
    }
  }, [token]);

  return { state, sessionToken: token, refresh, signOut };
}
