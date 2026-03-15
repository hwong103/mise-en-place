# Mise en Place

A calm household cooking app for singles and couples to save recipes, plan the week, shop once, and keep a lightweight wine cellar in sync.

This project now runs on Cloudflare. Vercel is no longer part of the deployment path.

## What It Does

- Save recipes from the web or enter them manually
- Organize prep, ingredients, notes, and source media for each recipe
- Plan meals across the week with drag-and-drop scheduling
- Generate and manage a shopping list grouped by store/location
- Share a household with guests or signed-in members
- Track wines, tasting notes, and cellar details in the built-in cellar

## Current Feature Set

- Recipe ingestion:
  - URL import (Markdown-first via `markdown.new`, HTML fallback)
  - Manual recipe entry
- Recipe detail management:
  - Ingredients, instructions, notes, prep groups
  - Optional source URL, image URL, and video URL
- Weekly planner:
  - Drag and drop recipes into meal slots
- Shopping list:
  - Auto-generated from planned meals
  - Manual item additions, location grouping, and check-off state
- Cellar:
  - Manual wine logging and editing
  - Tasting notes, ratings, type, producer, and region tracking
  - Price and stockist groundwork for cellar workflows
- Auth + tenant scoping:
  - Anonymous household start + share-link access
  - Better Auth login with Google SSO and magic links for ownership claim/management
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
- Prisma client + Cloudflare D1 adapter
- Better Auth + Resend
- OpenNext for Cloudflare Workers
- Cloudflare Workers + D1 + R2 cache bucket
- dnd-kit
- Vitest

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Configure environment variables

```bash
cp .env.example .env.local
```

3. Generate the Prisma client

```bash
npx prisma generate
```

4. Run the local Next.js app

```bash
npm run dev
```

5. Preview against the Cloudflare runtime when needed

```bash
npm run cf:preview
```

For deployed environments, apply your D1 schema with Wrangler and then deploy the Worker bundle:

```bash
npm run cf:build
npm run deploy
```

## Environment Variables

Required runtime variables:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `AUTH_FROM_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

Optional variables:

- `DEFAULT_HOUSEHOLD_NAME` (default: `My Household`)
- `HOUSEHOLD_SHARE_SIGNING_SECRET` (required in production for household share tokens and signed guest sessions)
- `HOUSEHOLD_GUEST_SESSION_DAYS` (default: `90`; sliding guest session window)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (reserved for future managed image storage)
- `DISABLE_AUTH` (set to `true` only for debugging to bypass server auth)
- `NEXT_PUBLIC_DISABLE_AUTH` (client-only debug messaging toggle)
- `INGEST_ENABLE_WEBMCP` (default: `false`; placeholder for future WebMCP-backed ingestion experiments)
- `PERF_LOGGING_ENABLED` (default: `true`; emits structured server timing logs for auth/household/recipe flows)

## Quality Gates

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test:run`
- Build: `npm run build`
- Cloudflare build: `npm run cf:build`
- Cloudflare preview: `npm run cf:preview`
- Ingestion benchmark: `npm run ingestion:benchmark`
- Ingestion regression check: `npm run ingestion:regression-check`

CI runs all of the above on push and pull requests.

## URL Ingestion Pipeline

The URL import flow now uses a staged strategy with quality scoring:

1. `markdown.new` markdown extraction
2. direct HTTP HTML + JSON-LD parsing

Structured import diagnostics are logged as JSON with source host, stage used, attempt latencies, quality score, and failure reason.

## Known Limitations

- URL import quality still depends on source website structure and anti-bot protections.
- Share-link access is intended for low-risk household planning data; anyone with an active link can edit household content.

## Household Sharing Model

- Start anonymously via `POST /start-household` from the home/login CTA.
- Share via `GET /join/<token>` invite link.
- Guests receive a signed household session cookie (sliding expiration).
- Managers can rotate links from Settings; rotation invalidates prior links and guest sessions.
- Ownership can be claimed later via Better Auth login (`/claim-household` flow), which grants durable manager access across devices.

## Better Auth Redirect Setup

To avoid magic links redirecting to the wrong host (for example `localhost`), configure both:

- `NEXT_PUBLIC_SITE_URL` and `BETTER_AUTH_URL` in your app environment
- Google OAuth redirect URLs:
  - `http://localhost:3000/api/auth/callback/google` (dev)
  - your deployed callback URL(s), e.g. `https://<your-domain>/api/auth/callback/google`
- Resend sender verification for `AUTH_FROM_EMAIL`

## Cloudflare Runtime

- `wrangler.jsonc` is the source of truth for the deployed runtime.
- It defines the Cloudflare Worker entrypoint, D1 binding (`DB`), asset binding, image binding, and R2 cache bucket used by OpenNext.
- Use `.dev.vars` for local Worker secrets and `wrangler secret put` / dashboard secrets for deployed environments.
- Use `npm run dev` for fast app iteration and `npm run cf:preview` when you need to verify Cloudflare-specific behavior locally.
- Vercel is no longer used for preview or production deployment.
