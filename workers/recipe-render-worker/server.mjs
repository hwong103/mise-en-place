import { createServer } from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT ?? 8787);
const WORKER_TOKEN = process.env.RENDER_WORKER_TOKEN ?? "";
const NAVIGATION_TIMEOUT_MS = Number(process.env.RENDER_NAVIGATION_TIMEOUT_MS ?? 10000);
const MAX_HTML_BYTES = Number(process.env.RENDER_MAX_HTML_BYTES ?? 2_000_000);
const ALLOWED_HOSTS = (process.env.RENDER_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

let browserPromise;

const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload_too_large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const isPrivateIp = (hostname) => {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return false;
  }

  const [a, b] = hostname.split(".").map(Number);
  if (a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
};

const isBlockedHostname = (hostname) => {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal")
  ) {
    return true;
  }

  if (isPrivateIp(normalized)) {
    return true;
  }

  if (ALLOWED_HOSTS.length > 0) {
    return !ALLOWED_HOSTS.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
  }

  return false;
};

const ensureBrowser = async () => {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }

  return browserPromise;
};

const renderPage = async (targetUrl) => {
  const browser = await ensureBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });

    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

    const rendered = await page.evaluate(() => {
      const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        .map((script) => script.textContent?.trim() ?? "")
        .filter(Boolean)
        .flatMap((raw) => {
          try {
            return [JSON.parse(raw)];
          } catch {
            return [];
          }
        });

      return {
        finalUrl: window.location.href,
        html: document.documentElement.outerHTML,
        jsonLd,
      };
    });

    return rendered;
  } finally {
    await page.close();
    await context.close();
  }
};

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method !== "POST" || req.url !== "/") {
    json(res, 404, { error: "not_found" });
    return;
  }

  if (WORKER_TOKEN) {
    const authHeader = req.headers.authorization ?? "";
    const expected = `Bearer ${WORKER_TOKEN}`;
    if (authHeader !== expected) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
  }

  try {
    const body = await readBody(req);
    const payload = JSON.parse(body || "{}");
    const targetUrl = typeof payload.url === "string" ? payload.url : "";

    if (!targetUrl) {
      json(res, 400, { error: "missing_url" });
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      json(res, 400, { error: "invalid_url" });
      return;
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      json(res, 400, { error: "unsupported_protocol" });
      return;
    }

    if (isBlockedHostname(parsedUrl.hostname)) {
      json(res, 403, { error: "blocked_host" });
      return;
    }

    const rendered = await renderPage(parsedUrl.toString());
    const html = rendered.html.length > MAX_HTML_BYTES
      ? rendered.html.slice(0, MAX_HTML_BYTES)
      : rendered.html;

    json(res, 200, {
      finalUrl: rendered.finalUrl,
      html,
      jsonLd: rendered.jsonLd,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "payload_too_large" ? 413 : 500;
    json(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`recipe-render-worker listening on ${PORT}`);
});
