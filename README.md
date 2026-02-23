# Mise en Place

Household recipe management with URL import, OCR import, weekly planning, and shopping list generation.

## Current Feature Set

- Recipe ingestion:
  - URL import (Markdown-first via `markdown.new`, HTML fallback)
  - Photo OCR import (Tesseract in-browser)
  - Manual recipe entry
- Recipe detail management:
  - Ingredients, instructions, notes, prep groups
  - Optional source URL, image URL, and video URL
- Weekly planner:
  - Drag and drop recipes into meal slots
- Shopping list:
  - Auto-generated from planned meals
  - Manual item additions and check-off state
- Auth + tenant scoping:
  - Anonymous household start + share-link access
  - Optional Supabase magic-link login for ownership claim/management
  - Data scoped to household access context (guest link or authenticated membership)
- Settings (v1):
  - Household overview
  - Member list
  - Share link view/rotate for manager
  - Household ownership claim flow

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma + PostgreSQL
- Supabase Auth
- Tesseract.js + heic2any
- dnd-kit
- Vitest

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env
```

3. Prepare database

```bash
npx prisma generate
npx prisma db push
```

4. Run app

```bash
npm run dev
```

## Environment Variables

Required runtime variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (recommended for stable magic-link redirects, e.g. your deployed app URL)

Optional variables:

- `DEFAULT_HOUSEHOLD_NAME` (default: `My Household`)
- `HOUSEHOLD_SHARE_SIGNING_SECRET` (required in production for household share tokens and signed guest sessions)
- `HOUSEHOLD_GUEST_SESSION_DAYS` (default: `90`; sliding guest session window)
- `SUPABASE_SERVICE_ROLE_KEY` (reserved for future admin flows)
- `OPENAI_API_KEY` and `NEXT_PUBLIC_OCR_PROVIDER` (reserved for future OCR provider expansion)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (reserved for future managed image storage)
- `DISABLE_AUTH` (set to `true` only for debugging to bypass server auth)
- `NEXT_PUBLIC_DISABLE_AUTH` (client-only debug messaging toggle)
- `INGEST_ENABLE_RENDER_FALLBACK` (default: `true`; set `false` to disable rendered-page fallback)
- `INGEST_RENDER_WORKER_URL` (URL of the dedicated render worker endpoint)
- `INGEST_RENDER_WORKER_TOKEN` (bearer token passed to the render worker)
- `INGEST_RENDER_TIMEOUT_MS` (default: `12000`)
- `INGEST_ENABLE_WEBMCP` (default: `false`; placeholder for future WebMCP-backed ingestion experiments)
- `PERF_LOGGING_ENABLED` (default: `true`; emits structured server timing logs for auth/household/recipe flows)

## Quality Gates

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test:run`
- Build: `npm run build`
- Ingestion benchmark: `npm run ingestion:benchmark`
- Ingestion regression check: `npm run ingestion:regression-check`

CI runs all of the above on push and pull requests.

## URL Ingestion Pipeline

The URL import flow now uses a staged strategy with quality scoring:

1. `markdown.new` markdown extraction
2. direct HTTP HTML + JSON-LD parsing
3. rendered HTML fallback via dedicated Playwright worker
4. readability/article fallback for noisy pages

Structured import diagnostics are logged as JSON with source host, stage used, attempt latencies, quality score, and failure reason.

### Render Worker (Optional, recommended)

The rendered-page fallback expects a dedicated worker service at `/workers/recipe-render-worker`.

```bash
cd workers/recipe-render-worker
npm install
npx playwright install chromium
npm start
```

## Known Limitations

- URL import quality still depends on source website structure and anti-bot protections (render fallback improves, but does not eliminate, hard failures).
- OCR quality depends on image clarity, lighting, and text layout.
- Share-link access is intended for low-risk household planning data; anyone with an active link can edit household content.

## Household Sharing Model

- Start anonymously via `POST /start-household` from the home/login CTA.
- Share via `GET /join/<token>` invite link.
- Guests receive a signed household session cookie (sliding expiration).
- Managers can rotate links from Settings; rotation invalidates prior links and guest sessions.
- Ownership can be claimed later via Supabase login (`/claim-household` flow), which grants durable manager access across devices.

## Supabase Auth Redirect Setup

To avoid magic links redirecting to the wrong host (for example `localhost`), configure both:

- `NEXT_PUBLIC_SITE_URL` in your app environment
- Supabase Auth URL configuration:
  - `Site URL` set to your canonical app URL
  - `Additional Redirect URLs` include:
    - `http://localhost:3000/auth/callback` (dev)
    - your deployed callback URL(s), e.g. `https://<your-domain>/auth/callback`
