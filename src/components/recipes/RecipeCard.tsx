import Link from "next/link";
import type { Recipe } from "@prisma/client";

import { coerceStringArray } from "@/lib/recipe-utils";

const formatMinutes = (value?: number | null) => {
  if (!value) {
    return null;
  }

  return `${value} min`;
};

type RecipeCardProps = {
  recipe: Recipe;
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const tags = recipe.tags ?? [];
  const ingredients = coerceStringArray(recipe.ingredients);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600">
            {recipe.title}
          </h3>
          {recipe.description ? (
            <p className="mt-1 text-sm text-slate-500">{recipe.description}</p>
          ) : null}
        </div>
        {recipe.imageUrl ? (
          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
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

      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {ingredients.length > 0 ? (
        <div className="mt-4 text-xs text-slate-400">
          {ingredients.length} ingredient{ingredients.length === 1 ? "" : "s"}
        </div>
      ) : null}
    </Link>
  );
}
