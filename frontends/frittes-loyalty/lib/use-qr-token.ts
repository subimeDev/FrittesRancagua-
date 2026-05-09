"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, type QrTokenDto, apiRequest } from "@/lib/api";

type QrTokenState = {
  token: string | null;
  expAt: number | null;
  loading: boolean;
};

/**
 * TODO backend:
 * GET /api/v1/loyalty/qr-tokens -> { token, exp_at } con TTL 90s
 */
export function useQrToken(sessionToken: string | null): {
  token: string | null;
  secondsLeft: number;
  isExpired: boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<QrTokenState>({
    token: null,
    expAt: null,
    loading: false,
  });

  const refresh = useCallback(async () => {
    if (!sessionToken) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await apiRequest<QrTokenDto>("/loyalty/qr-tokens", {
        token: sessionToken,
      });
      setState({
        token: data.token,
        expAt: new Date(data.exp_at).getTime(),
        loading: false,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      if (error instanceof ApiError && error.code === "unauthenticated") throw error;
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;
    void refresh();
  }, [refresh, sessionToken]);

  useEffect(() => {
    if (!state.expAt || !sessionToken) return;
    const msLeft = state.expAt - Date.now();
    const timeoutMs = Math.max(msLeft - 10_000, 0);
    const timeout = window.setTimeout(() => {
      void refresh();
    }, timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [state.expAt, refresh, sessionToken]);

  const secondsLeft = useMemo(() => {
    if (!state.expAt) return 0;
    return Math.max(Math.ceil((state.expAt - Date.now()) / 1000), 0);
  }, [state.expAt, state.loading]);

  return {
    token: state.token,
    secondsLeft,
    isExpired: state.token !== null && secondsLeft <= 0,
    refresh,
  };
}
