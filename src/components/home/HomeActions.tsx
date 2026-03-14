"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

type SessionPayload = {
  user?: {
    id?: string | null;
  } | null;
} | null;

type HomeActionsProps = {
  authDisabled: boolean;
};

export default function HomeActions({ authDisabled }: HomeActionsProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(authDisabled ? false : false);

  useEffect(() => {
    if (authDisabled) {
      return;
    }

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
          setIsLoggedIn(false);
          return;
        }

        const payload = (await response.json()) as SessionPayload;
        setIsLoggedIn(Boolean(payload?.user?.id));
      } catch {
        if (mounted) {
          setIsLoggedIn(false);
        }
      }
    };

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [authDisabled]);

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href="/recipes"
        className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-300 hover:bg-emerald-600 active:translate-y-[1px]"
      >
        Open Recipes
        <ArrowRight className="h-4 w-4" />
      </Link>

      {!isLoggedIn ? (
        <>
          {authDisabled ? (
            <Link
              href="/recipes"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
            >
              Continue Without Login
            </Link>
          ) : (
            <form method="post" action="/start-household">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
              >
                Start Without Login
              </button>
            </form>
          )}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-300 hover:border-emerald-200 hover:text-emerald-700 active:translate-y-[1px] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
          >
            Login / Claim
          </Link>
        </>
      ) : null}
    </div>
  );
}
