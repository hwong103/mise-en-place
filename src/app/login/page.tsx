"use client";

import { FormEvent, useMemo, useState } from "react";
import { getBrowserSupabaseClient, hasSupabasePublicEnv } from "@/lib/supabase/client";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const isAuthDisabled = /^(1|true|yes)$/i.test(process.env.NEXT_PUBLIC_DISABLE_AUTH ?? "");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const configuredSiteUrl = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    return raw ? trimTrailingSlash(raw) : null;
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    const supabase = getBrowserSupabaseClient();
    if (!supabase) {
      setPending(false);
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    const origin = trimTrailingSlash(window.location.origin);
    const baseUrl = configuredSiteUrl ?? origin;
    const redirectTo = `${baseUrl}/auth/callback`;

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setPending(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage(`Check your email for the sign-in link. Redirect target: ${redirectTo}`);
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-500">
        Use a magic link to sign in with Supabase Auth.
      </p>

      {isAuthDisabled ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Auth is disabled for debugging. You can go directly to the app routes.
        </div>
      ) : null}

      {!hasSupabasePublicEnv ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none"
          placeholder="you@example.com"
        />

        <button
          type="submit"
          disabled={pending || !hasSupabasePublicEnv || isAuthDisabled}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {pending ? "Sending..." : "Send Magic Link"}
        </button>
      </form>

      {configuredSiteUrl ? (
        <p className="mt-4 text-xs text-slate-400">Using NEXT_PUBLIC_SITE_URL={configuredSiteUrl}</p>
      ) : null}

      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
