"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const menuId = useId();

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

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
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
        className="ui-icon-button"
        aria-label="Theme settings"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Theme settings"
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme options"
          className="ui-menu absolute right-0 top-full mt-2 w-36 overflow-hidden py-1"
        >
          {OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => select(value)}
              role="menuitemradio"
              aria-checked={preference === value}
              className={`ui-menu-item flex items-center gap-2.5 font-medium ${
                preference === value ? "ui-menu-item-active" : ""
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
              {preference === value && (
                <span className="ml-auto" style={{ color: "var(--accent-text)" }}>
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
