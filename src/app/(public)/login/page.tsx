"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

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

type AuthApiResponse = {
  redirect?: boolean;
  url?: string;
  error?: {
    message?: string;
  };
};

const readApiError = async (response: Response) => {
  try {
    const payload = (await response.json()) as AuthApiResponse;
    return payload.error?.message ?? `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const nextPath =
    typeof window === "undefined"
      ? "/recipes"
      : normalizeNextPath(new URLSearchParams(window.location.search).get("next"));

  const onMagicLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMagicLinkPending(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email,
        callbackURL: nextPath,
        newUserCallbackURL: nextPath,
        errorCallbackURL: `/login?next=${encodeURIComponent(nextPath)}`,
      }),
    });

    setMagicLinkPending(false);

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    setMessage(`Check your email for the sign-in link. You’ll land on ${nextPath} after sign-in.`);
  };

  const onGoogleSignIn = async () => {
    setGooglePending(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        provider: "google",
        callbackURL: nextPath,
        newUserCallbackURL: nextPath,
        errorCallbackURL: `/login?next=${encodeURIComponent(nextPath)}`,
        disableRedirect: true,
      }),
    });

    if (!response.ok) {
      setGooglePending(false);
      setError(await readApiError(response));
      return;
    }

    const payload = (await response.json()) as AuthApiResponse;
    if (!payload.url) {
      setGooglePending(false);
      setError("Google sign-in did not return a redirect URL.");
      return;
    }

    window.location.assign(payload.url);
  };

  const currentError =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("error");

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Login</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Sign in with Google or request a magic link.
      </p>

      {isAuthDisabled ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
          Auth is disabled for debugging. You can go directly to the app routes.
        </div>
      ) : null}

      {!isAuthDisabled ? (
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={googlePending}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
        >
          {googlePending ? "Redirecting to Google..." : "Continue with Google"}
        </button>
      ) : null}

      <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span>or</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <form className="mt-6 space-y-4" onSubmit={onMagicLinkSubmit}>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="you@example.com"
        />

        <button
          type="submit"
          disabled={magicLinkPending || isAuthDisabled}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {magicLinkPending ? "Sending..." : "Send Magic Link"}
        </button>
      </form>

      <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
        {isAuthDisabled ? (
          <>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Continue without login</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Auth is disabled in this environment.</p>
            <Link
              href="/recipes"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
            >
              Continue to Recipes
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Or start without login</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Create a household instantly, then claim ownership later from Settings.
            </p>
            <form method="post" action="/start-household" className="mt-3">
              <button
                type="submit"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-300"
              >
                Start Household Without Login
              </button>
            </form>
          </>
        )}
      </div>

      {message ? <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
      {currentError && !error ? (
        <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
          Sign-in failed: {currentError.replace(/_/g, " ").toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}
