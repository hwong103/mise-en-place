"use client";

import { useMemo } from "react";
import Link from "next/link";
import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import { getWeekRange } from "@/lib/date";

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
  const nextWeekDate = useMemo(() => {
    const { start } = getWeekRange(new Date(), 1);
    const nextWeek = new Date(start);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split("T")[0];
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-lg">
      <div className="relative h-44 w-full">
        {recipe.imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="h-full w-full bg-slate-100" />
        )}
        <div className="absolute inset-x-0 top-0 p-5">
          <Link
            href={`/recipes/${recipe.id}`}
            className="inline-block rounded-xl bg-black/45 px-3 py-1 text-xl font-bold text-white drop-shadow-sm transition-colors"
          >
            {recipe.title}
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        {recipe.servings ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {recipe.servings} servings
          </span>
        ) : null}
        {formatMinutes(recipe.prepTime) ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Prep {formatMinutes(recipe.prepTime)}
          </span>
        ) : null}
        {formatMinutes(recipe.cookTime) ? (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Cook {formatMinutes(recipe.cookTime)}
          </span>
        ) : null}
        </div>

        {ingredientCount > 0 ? (
          <div className="mt-4 text-xs text-slate-400">
            {ingredientCount} ingredient{ingredientCount === 1 ? "" : "s"}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <AddToPlannerDialog
            recipeId={recipe.id}
            recipeTitle={recipe.title}
            defaultDate={nextWeekDate}
          />
          <Link
            href={`/recipes/${recipe.id}`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            View Recipe
          </Link>
        </div>
      </div>
    </div>
  );
}
