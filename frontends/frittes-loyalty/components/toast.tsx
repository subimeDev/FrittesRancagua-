"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ToastItem = {
  id: number;
  type: "error" | "success";
  message: string;
};

type ToastContextValue = {
  push: (type: "error" | "success", message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
let toastBridge: ToastContextValue["push"] | null = null;
let nextId = 1;

export const toast = {
  error(message: string): void {
    toastBridge?.("error", message);
  },
  success(message: string): void {
    toastBridge?.("success", message);
  },
};

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [items, setItems] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      push(type, message) {
        const id = nextId++;
        setItems((prev) => [...prev, { id, type, message }]);
        window.setTimeout(() => {
          setItems((prev) => prev.filter((item) => item.id !== id));
        }, 3000);
      },
    }),
    [],
  );

  toastBridge = value.push;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Mobile: abajo. Desktop: arriba-derecha. */}
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 space-y-2 sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-4 sm:w-[360px]">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={`toast-animate flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-card ${
              item.type === "error"
                ? "border-ember/30 bg-cream text-ink"
                : "border-forest/30 bg-cream text-ink"
            }`}
          >
            <span
              className={`mt-px flex-none text-xs font-bold ${
                item.type === "error" ? "text-ember" : "text-forest"
              }`}
            >
              {item.type === "error" ? "✕" : "✓"}
            </span>
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
