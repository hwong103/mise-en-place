# Recipe Render Worker

Dedicated Playwright service used as a rendered-page fallback for recipe ingestion.

## Setup

1. Install dependencies

```bash
cd workers/recipe-render-worker
npm install
npx playwright install chromium
```

2. Configure environment

```bash
cp .env.example .env
```

3. Start worker

```bash
npm start
```

## API

- `POST /` with JSON body `{ "url": "https://example.com/recipe" }`
- Optional `Authorization: Bearer <RENDER_WORKER_TOKEN>`
- Response: `{ finalUrl, html, jsonLd }`
- Healthcheck: `GET /healthz`

## Security/limits

- Blocks localhost/local/private network hosts.
- Optional `RENDER_ALLOWED_HOSTS` allowlist.
- Navigation timeout via `RENDER_NAVIGATION_TIMEOUT_MS`.
- Response size cap via `RENDER_MAX_HTML_BYTES`.
