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

const describeNextPath = (path: string) => {
  switch (path) {
    case "/recipes":
      return "the recipe library";
    case "/planner":
      return "the weekly planner";
    case "/shopping":
      return "the shopping list";
    case "/cellar":
      return "the cellar";
    case "/settings":
      return "settings";
    default:
      return path;
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const nextPath =
    typeof window === "undefined"
      ? "/recipes"
      : normalizeNextPath(new URLSearchParams(window.location.search).get("next"));
  const nextDestination = describeNextPath(nextPath);

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

    setMessage(`Check your email for the sign-in link. You’ll land on ${nextDestination} after sign-in.`);
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
    <div className="mx-auto max-w-md space-y-6 py-2 sm:py-4">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="ui-copy-muted text-sm leading-relaxed">
          Get back to {nextDestination}.
        </p>
      </div>

      {isAuthDisabled ? (
        <div className="ui-callout ui-callout-warning">
          Auth is disabled in this environment, so you can go straight into the app for local debugging.
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googlePending}
            className="ui-button ui-button-primary ui-button-block w-full active:translate-y-[1px]"
          >
            {googlePending ? "Redirecting to Google..." : "Continue with Google"}
          </button>

          {showEmailLogin ? (
            <form className="space-y-4" onSubmit={onMagicLinkSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  inputMode="email"
                  className="ui-input"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={magicLinkPending}
                className="ui-button ui-button-primary ui-button-block w-full active:translate-y-[1px]"
              >
                {magicLinkPending ? "Sending link..." : "Send sign-in link"}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowEmailLogin(true)}
              className="ui-copy-muted text-sm font-medium underline underline-offset-4"
            >
              Use email instead
            </button>
          )}
        </div>
      )}

      <div className="ui-divider border-t pt-5">
        {isAuthDisabled ? (
          <>
            <Link
              href="/recipes"
              className="ui-button ui-button-secondary ui-button-block w-full active:translate-y-[1px]"
            >
              Continue to Recipes
            </Link>
          </>
        ) : (
          <div className="ui-copy-muted text-sm leading-relaxed">
            <span>Prefer to start now? </span>
            <form method="post" action="/start-household" className="inline">
              <button type="submit" className="font-medium underline underline-offset-4">
                Start without login
              </button>
            </form>
          </div>
        )}
      </div>

      {message ? (
        <p className="ui-callout ui-callout-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="ui-callout ui-callout-danger" role="alert">
          {error}
        </p>
      ) : null}
      {currentError && !error ? (
        <p className="ui-callout ui-callout-danger" role="alert">
          Sign-in failed: {currentError.replace(/_/g, " ").toLowerCase()}.
        </p>
      ) : null}
    </div>
  );
}
