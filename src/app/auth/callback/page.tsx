"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

const isAuthDisabled = /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");
const normalizeNextPath = (value: string | null) => {
  if (!value) {
    return "/recipes";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/recipes";
  }
  return value;
};

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (isAuthDisabled) {
        window.location.replace("/recipes");
        return;
      }

      if (!hasSupabasePublicEnv) {
        setError("Auth is not configured.");
        return;
      }

      const supabase = getBrowserSupabaseClient();
      if (!supabase) {
        setError("Auth is not configured.");
        return;
      }

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const nextPath = normalizeNextPath(url.searchParams.get("next"));
      let exchangeErrorMessage: string | null = null;

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (exchangeError) {
          exchangeErrorMessage = exchangeError.message;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const retry = await supabase.auth.getSession();
      if (retry.data.session) {
        window.location.replace(nextPath);
        return;
      }

      if (exchangeErrorMessage && /code verifier/i.test(exchangeErrorMessage)) {
        setError(
          "This sign-in link was opened in a different browser/device. Request a new magic link and open it in the same browser."
        );
        return;
      }

      setError(exchangeErrorMessage ?? "Could not complete sign-in. Please request a new link.");
    };

    run();
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Signing you in...</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Completing your secure login.</p>
      {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  );
}
