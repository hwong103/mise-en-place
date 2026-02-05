# Mise en Place

A personal and shared household recipe repository that focuses on "prep-efficiency" and automated shopping lists.

## Features

- **Triple-Threat Ingestion**:
  - **OCR**: Image-to-text for physical cookbooks.
  - **Web Scraping**: Extract recipes from URLs.
  - **Manual**: Traditional form entry.
- **The "Mise" Section**: Group ingredients into prep-order steps (e.g., "Aromatics", "Sauce Base").
- **Weekly Planner**: Drag & drop recipe calendar.
- **Smart Shopping List**: 
  - Auto-generate from the Weekly Planner.
  - Checklist mode to confirm what you already have.
  - Support for manual non-recipe items.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** (PostgreSQL)
- **Supabase Auth**
- **Cloudinary** (Images)
- **@dnd-kit/core** (Drag & Drop)

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd mise-en-place
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your credentials.

```bash
cp .env.example .env
```

### 3. Database Setup

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Locally

```bash
npm run dev
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary name |
| `OPENAI_API_KEY` | (Optional) For GPT-4o Vision OCR |

## License

Open Source - MIT
