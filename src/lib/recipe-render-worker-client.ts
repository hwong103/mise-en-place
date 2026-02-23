export type RenderedRecipeCandidate = {
  finalUrl: string;
  html: string;
  jsonLd: unknown[];
};

type RenderWorkerResponse = {
  finalUrl?: string;
  html?: string;
  jsonLd?: unknown[];
};

const DEFAULT_TIMEOUT_MS = 12000;

const parseTimeout = (value: string | undefined) => {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.trunc(parsed);
};

const isEnabledByFlag = () => {
  const flag = process.env.INGEST_ENABLE_RENDER_FALLBACK;
  if (!flag) {
    return true;
  }

  return flag.toLowerCase() !== "false";
};

export const isRenderFallbackEnabled = () =>
  isEnabledByFlag() && Boolean(process.env.INGEST_RENDER_WORKER_URL);

export async function fetchRenderedRecipeCandidate(
  url: string
): Promise<RenderedRecipeCandidate | null> {
  const workerUrl = process.env.INGEST_RENDER_WORKER_URL;
  const workerToken = process.env.INGEST_RENDER_WORKER_TOKEN;

  if (!workerUrl || !isEnabledByFlag()) {
    return null;
  }

  const timeoutMs = parseTimeout(process.env.INGEST_RENDER_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(workerToken ? { Authorization: `Bearer ${workerToken}` } : {}),
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RenderWorkerResponse;
    if (typeof payload.html !== "string") {
      return null;
    }

    return {
      finalUrl: typeof payload.finalUrl === "string" ? payload.finalUrl : url,
      html: payload.html,
      jsonLd: Array.isArray(payload.jsonLd) ? payload.jsonLd : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
