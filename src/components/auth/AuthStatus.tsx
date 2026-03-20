"use client";

import { useEffect, useMemo, useState } from "react";

const isAuthDisabled = /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");

type AuthStatusProps = {
  hasHouseholdAccess?: boolean;
  accessSource?: "guest" | "auth" | "bootstrap" | null;
};

type SessionUser = {
  email?: string | null;
  name?: string | null;
};

type SessionPayload = {
  user?: SessionUser | null;
} | null;

export default function AuthStatus({ hasHouseholdAccess = false, accessSource = null }: AuthStatusProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/get-session", {
          credentials: "include",
          cache: "no-store",
        });

        if (!mounted) {
          return;
        }

        if (!response.ok) {
          setUser(null);
          setLoading(false);
          return;
        }

        const payload = (await response.json()) as SessionPayload;
        setUser(payload?.user ?? null);
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (isAuthDisabled) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const label = useMemo(() => {
    if (!user) {
      return null;
    }

    return user.email ?? user.name ?? "Signed in";
  }, [user]);

  if (isAuthDisabled) {
    return <span className="text-xs text-amber-600 dark:text-amber-400">Auth disabled</span>;
  }

  if (loading) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">Loading...</span>;
  }

  if (!user) {
    if (hasHouseholdAccess && accessSource === "guest") {
      return (
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 md:inline">Guest access</span>
          <a
            href="/login"
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:text-emerald-300"
          >
            Login
          </a>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/session/clear", { method: "POST", credentials: "include" });
              window.location.assign("/");
            }}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-400/30 dark:hover:text-rose-300"
          >
            Leave
          </button>
        </div>
      );
    }

    return (
      <a
        href="/login"
        className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Login
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[200px] truncate text-xs text-slate-500 dark:text-slate-400 md:inline">{label}</span>
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/sign-out", {
            method: "POST",
            credentials: "include",
          });
          await fetch("/api/session/clear", { method: "POST", credentials: "include" });
          window.location.assign("/login");
        }}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Logout
      </button>
    </div>
  );
}
