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
  - Supabase magic-link login
  - Data scoped to the authenticated user household membership
- Settings (v1):
  - Household overview
  - Member list
  - Invite/member management stub

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

Optional variables:

- `DEFAULT_HOUSEHOLD_NAME` (default: `My Household`)
- `SUPABASE_SERVICE_ROLE_KEY` (reserved for future admin flows)
- `OPENAI_API_KEY` and `NEXT_PUBLIC_OCR_PROVIDER` (reserved for future OCR provider expansion)
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (reserved for future managed image storage)

## Quality Gates

- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm run test:run`
- Build: `npm run build`

CI runs all of the above on push and pull requests.

## Known Limitations

- URL import quality depends on source website structure and anti-bot protections.
- OCR quality depends on image clarity, lighting, and text layout.
- Settings invite/member management is currently a documented stub.

