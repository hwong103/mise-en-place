import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { getD1Database } from "@/lib/d1";

const trimToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const configuredBaseUrl =
  trimToUndefined(process.env.BETTER_AUTH_URL) ?? trimToUndefined(process.env.NEXT_PUBLIC_SITE_URL);
const googleClientId = trimToUndefined(process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = trimToUndefined(process.env.GOOGLE_CLIENT_SECRET);
const authFromEmail = trimToUndefined(process.env.AUTH_FROM_EMAIL) ?? "noreply@hwong103.work";

const getResendClient = () => {
  const apiKey = trimToUndefined(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
};

const authCache = new WeakMap<object, ReturnType<typeof betterAuth>>();

export const getAuth = () => {
  const db = getD1Database();
  const cacheKey = db as object;
  const cached = authCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const auth = betterAuth({
    secret: trimToUndefined(process.env.BETTER_AUTH_SECRET),
    ...(configuredBaseUrl ? { baseURL: configuredBaseUrl } : {}),
    basePath: "/api/auth",
    advanced: {
      trustedProxyHeaders: true,
    },
    database: db,
    user: {
      modelName: "AuthUser",
    },
    session: {
      modelName: "AuthSession",
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    account: {
      modelName: "AuthAccount",
    },
    verification: {
      modelName: "AuthVerification",
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              prompt: "select_account",
            },
          }
        : {},
    plugins: [
      nextCookies(),
      magicLink({
        expiresIn: 60 * 15,
        sendMagicLink: async ({ email, url }) => {
          await getResendClient().emails.send({
            from: authFromEmail,
            to: email,
            subject: "Sign in to Mise en Place",
            html: `
              <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;color:#0f172a">
                <p>Use the secure link below to sign in to Mise en Place.</p>
                <p><a href="${url}">Sign in to your household</a></p>
                <p>If you did not request this email, you can ignore it.</p>
              </div>
            `,
          });
        },
      }),
    ],
  }) as unknown as ReturnType<typeof betterAuth>;

  authCache.set(cacheKey, auth);
  return auth;
};
