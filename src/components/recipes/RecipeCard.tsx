"use client";

import Link from "next/link";
import { useState, type SyntheticEvent } from "react";
import CountUp from "@/components/ui/CountUp";

const formatMinutes = (value?: number | null) => {
  if (!value) {
    return null;
  }

  return `${value} min`;
};

export type RecipeSummary = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceUrl?: string | null;
  tags?: string[];
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  ingredientCount: number;
  cookCount?: number;
};

const getSourceDomain = (sourceUrl?: string | null): string | null => {
  if (!sourceUrl) {
    return null;
  }

  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const parts = hostname.split(".").filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 2] : hostname;
  } catch {
    return null;
  }
};

function FaviconImage({ faviconUrl, domain }: { faviconUrl: string; domain: string }) {
  const [failed, setFailed] = useState(false);

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    // Google returns a 16x16 grey globe for unknown domains. Treat it as a fallback case.
    if (e.currentTarget.naturalWidth <= 16) {
      setFailed(true);
    }
  };

  if (failed) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/25 text-[9px] font-bold uppercase text-white">
        {domain.charAt(0)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={faviconUrl}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4 shrink-0 rounded-full object-cover"
      onLoad={handleLoad}
      onError={() => setFailed(true)}
    />
  );
}

function AuthorBadge({ sourceUrl }: { sourceUrl: string }) {
  const domain = getSourceDomain(sourceUrl);
  if (!domain) {
    return null;
  }

  const hostname = (() => {
    try {
      return new URL(sourceUrl).hostname;
    } catch {
      return "";
    }
  })();
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 backdrop-blur-md transition-colors group-hover:bg-white/[0.22]">
      <FaviconImage faviconUrl={faviconUrl} domain={domain} />
      <span className="text-[11px] font-semibold leading-none text-white/90">{domain}</span>
    </div>
  );
}

type RecipeCardProps = {
  recipe: RecipeSummary;
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const ingredientCount = recipe.ingredientCount;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      prefetch={false}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-400"
    >
      <div className="relative h-44 w-full">
        {recipe.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(0,0,0,0.45)_0%,transparent_60%)]" />
            {recipe.sourceUrl ? <AuthorBadge sourceUrl={recipe.sourceUrl} /> : null}
          </>
        ) : (
          <div className="h-full w-full bg-slate-100 dark:bg-slate-800" />
        )}
        <div className="absolute inset-x-0 top-0 p-5">
          <span className="inline-block rounded-xl bg-black/45 px-3 py-1 text-xl font-bold text-white drop-shadow-sm transition-colors group-hover:bg-black/55">
            {recipe.title}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          {recipe.servings ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800 dark:text-slate-300">
              {recipe.servings} servings
            </span>
          ) : null}
          {formatMinutes(recipe.prepTime) ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800 dark:text-slate-300">
              Prep {formatMinutes(recipe.prepTime)}
            </span>
          ) : null}
          {formatMinutes(recipe.cookTime) ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800 dark:text-slate-300">
              Cook {formatMinutes(recipe.cookTime)}
            </span>
          ) : null}
        </div>

        {ingredientCount > 0 ? (
          <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
          </div>
        ) : null}

        {recipe.cookCount && recipe.cookCount > 0 ? (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <span className="text-sm">🍳</span>
            Cooked x<CountUp to={recipe.cookCount} duration={600} />
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors group-hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:bg-slate-800">
            View Recipe
          </span>
        </div>
      </div>
    </Link>
  );
}
