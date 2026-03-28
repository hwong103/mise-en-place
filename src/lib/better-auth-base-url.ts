const LOCALHOST_HOST_PATTERNS = ["localhost:*", "127.0.0.1:*", "[::1]:*"];
const CLOUDFLARE_PREVIEW_HOST_PATTERNS = ["*.workers.dev", "*.pages.dev"];

const trimToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const toConfiguredUrl = (value: string | undefined) => {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed);
  } catch {
    return undefined;
  }
};

const toAllowedHostPattern = (value: string | undefined) => {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }

  const configuredUrl = toConfiguredUrl(trimmed);
  if (configuredUrl) {
    return configuredUrl.host;
  }

  return trimmed.replace(/\/+$/, "");
};

const unique = (values: Array<string | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export const getBetterAuthBaseUrlConfig = () => {
  const configuredBaseUrls = [
    toConfiguredUrl(process.env.BETTER_AUTH_URL),
    toConfiguredUrl(process.env.NEXT_PUBLIC_SITE_URL),
  ].filter((value): value is URL => Boolean(value));

  const configuredAllowedHosts = configuredBaseUrls.map((value) => value.host);
  const envAllowedHosts = (process.env.BETTER_AUTH_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => toAllowedHostPattern(value));

  const protocol =
    configuredBaseUrls[0]?.protocol === "http:" || configuredBaseUrls[0]?.protocol === "https:"
      ? (configuredBaseUrls[0].protocol.slice(0, -1) as "http" | "https")
      : process.env.NODE_ENV === "development"
        ? "http"
        : "https";

  return {
    allowedHosts: unique([
      ...configuredAllowedHosts,
      ...LOCALHOST_HOST_PATTERNS,
      ...CLOUDFLARE_PREVIEW_HOST_PATTERNS,
      ...envAllowedHosts,
    ]),
    protocol,
  };
};
