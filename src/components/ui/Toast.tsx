"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  const timeoutIdsRef = useRef<number[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutIdsRef.current = [];
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = counterRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      timeoutIdsRef.current = timeoutIdsRef.current.filter((currentId) => currentId !== timeoutId);
    }, 3500);
    timeoutIdsRef.current.push(timeoutId);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 md:bottom-6 md:right-6">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.95 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
              className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${
                toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : toast.type === "error"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              }`}
            >
              {toast.type === "success" ? <span>✓</span> : null}
              {toast.type === "error" ? <span>✕</span> : null}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
