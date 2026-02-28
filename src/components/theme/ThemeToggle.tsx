"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "theme";

type ThemePreference = "light" | "dark" | "system";

const getSystemTheme = (): "light" | "dark" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const applyTheme = (preference: ThemePreference) => {
  const effective = preference === "system" ? getSystemTheme() : preference;
  const isDark = effective === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);
  document.documentElement.style.colorScheme = isDark ? "dark" : "light";
};

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply theme + listen for OS changes when in system mode
  useEffect(() => {
    applyTheme(preference);

    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handle = () => applyTheme("system");
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [preference]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const select = (value: ThemePreference) => {
    setPreference(value);
    applyTheme(value);
    if (value === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    }
    setOpen(false);
  };

  const CurrentIcon = OPTIONS.find((o) => o.value === preference)?.Icon ?? Monitor;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — same size/style as the original toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Theme settings"
        title="Theme settings"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => select(value)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition-colors
                ${preference === value
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {preference === value && (
                <span className="ml-auto text-emerald-600 dark:text-emerald-400">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
