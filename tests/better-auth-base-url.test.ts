import { afterEach, describe, expect, it } from "vitest";

import { getBetterAuthBaseUrlConfig } from "@/lib/better-auth-base-url";

const mutableEnv = process.env as Record<string, string | undefined>;

const originalEnv = {
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  BETTER_AUTH_ALLOWED_HOSTS: process.env.BETTER_AUTH_ALLOWED_HOSTS,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  mutableEnv.BETTER_AUTH_URL = originalEnv.BETTER_AUTH_URL;
  mutableEnv.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
  mutableEnv.BETTER_AUTH_ALLOWED_HOSTS = originalEnv.BETTER_AUTH_ALLOWED_HOSTS;
  mutableEnv.NODE_ENV = originalEnv.NODE_ENV;
});

describe("getBetterAuthBaseUrlConfig", () => {
  it("includes configured hosts, preview patterns, and extra allowlist entries", () => {
    mutableEnv.BETTER_AUTH_URL = "https://mise-en-place.hwong103.work";
    mutableEnv.NEXT_PUBLIC_SITE_URL = "https://mise-en-place.hwong103.work";
    mutableEnv.BETTER_AUTH_ALLOWED_HOSTS =
      "*.mise-en-place.hwong103.work, https://staging.mise-en-place.hwong103.work";

    expect(getBetterAuthBaseUrlConfig()).toEqual({
      allowedHosts: [
        "mise-en-place.hwong103.work",
        "localhost:*",
        "127.0.0.1:*",
        "[::1]:*",
        "*.workers.dev",
        "*.pages.dev",
        "*.mise-en-place.hwong103.work",
        "staging.mise-en-place.hwong103.work",
      ],
      protocol: "https",
    });
  });

  it("falls back to a development-safe protocol when no configured URL is present", () => {
    delete mutableEnv.BETTER_AUTH_URL;
    delete mutableEnv.NEXT_PUBLIC_SITE_URL;
    delete mutableEnv.BETTER_AUTH_ALLOWED_HOSTS;
    mutableEnv.NODE_ENV = "development";

    expect(getBetterAuthBaseUrlConfig()).toEqual({
      allowedHosts: [
        "localhost:*",
        "127.0.0.1:*",
        "[::1]:*",
        "*.workers.dev",
        "*.pages.dev",
      ],
      protocol: "http",
    });
  });
});
