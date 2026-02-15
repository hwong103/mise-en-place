"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
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

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (exchangeError) {
          if (/code verifier/i.test(exchangeError.message)) {
            setError(
              "This sign-in link was opened in a different browser/device. Request a new magic link and open it in the same browser."
            );
            return;
          }
          setError(exchangeError.message);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const retry = await supabase.auth.getSession();
      if (!retry.data.session) {
        setError("Could not complete sign-in. Please request a new link.");
        return;
      }

      window.location.replace("/recipes");
    };

    run();
  }, []);

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Signing you in...</h1>
      <p className="mt-2 text-sm text-slate-500">Completing your secure login.</p>
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
