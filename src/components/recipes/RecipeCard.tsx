"use client";

import Link from "next/link";

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
  tags?: string[];
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  ingredientCount: number;
};

type RecipeCardProps = {
  recipe: RecipeSummary;
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const ingredientCount = recipe.ingredientCount;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-emerald-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-400">
      <div className="relative h-44 w-full">
        {recipe.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-slate-100 dark:bg-slate-800" />
        )}
        <div className="absolute inset-x-0 top-0 p-5">
          <Link
            href={`/recipes/${recipe.id}`}
            prefetch={false}
            className="inline-block rounded-xl bg-black/45 px-3 py-1 text-xl font-bold text-white drop-shadow-sm transition-colors"
          >
            {recipe.title}
          </Link>
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={`/recipes/${recipe.id}`}
            prefetch={false}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            View Recipe
          </Link>
        </div>
      </div>
    </div>
  );
}
