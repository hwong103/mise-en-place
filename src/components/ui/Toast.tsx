"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type Toast = {
    id: number;
    message: string;
    type: ToastType;
};

type ToastContextValue = {
    showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const counterRef = useRef(0);

    const showToast = useCallback((message: string, type: ToastType = "success") => {
        const id = counterRef.current++;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-[toast-in_0.2s_ease-out] flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl
                ${toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : toast.type === "error"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                }`}
          >
            {toast.type === "success" && <span>✓</span>}
            {toast.type === "error" && <span>✕</span>}
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx;
}
