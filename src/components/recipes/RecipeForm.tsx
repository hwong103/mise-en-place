"use client";

import type { Recipe } from "@prisma/client";

export type RecipeFormValues = {
  title: string;
  description?: string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  tags?: string[] | null;
  ingredients?: string[] | null;
  instructions?: string[] | null;
  notes?: string[] | null;
};

type RecipeFormProps = {
  action: (formData: FormData) => Promise<void>;
  submitLabel?: string;
  initialValues?: RecipeFormValues;
  recipeId?: Recipe["id"];
};

const joinLines = (lines?: string[] | null) => (lines?.length ? lines.join("\n") : "");
const joinTags = (tags?: string[] | null) => (tags?.length ? tags.join(", ") : "");

export default function RecipeForm({
  action,
  submitLabel = "Save Recipe",
  initialValues,
  recipeId,
}: RecipeFormProps) {
  return (
    <form action={action} className="space-y-8">
      {recipeId ? <input type="hidden" name="recipeId" value={recipeId} /> : null}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="title">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={initialValues?.title ?? ""}
          placeholder="Sheet-Pan Chicken Tacos"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initialValues?.description ?? ""}
          placeholder="A quick, weeknight-friendly taco platter with roasted veggies."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="sourceUrl">
            Source URL
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            defaultValue={initialValues?.sourceUrl ?? ""}
            placeholder="https://example.com/recipe"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="imageUrl">
            Image URL
          </label>
          <input
            id="imageUrl"
            name="imageUrl"
            type="url"
            defaultValue={initialValues?.imageUrl ?? ""}
            placeholder="https://images..."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="videoUrl">
          Video URL
        </label>
        <input
          id="videoUrl"
          name="videoUrl"
          type="url"
          defaultValue={initialValues?.videoUrl ?? ""}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="servings">
            Servings
          </label>
          <input
            id="servings"
            name="servings"
            type="number"
            min={1}
            defaultValue={initialValues?.servings ?? undefined}
            placeholder="4"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="prepTime">
            Prep Time (min)
          </label>
          <input
            id="prepTime"
            name="prepTime"
            type="number"
            min={1}
            defaultValue={initialValues?.prepTime ?? undefined}
            placeholder="15"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="cookTime">
            Cook Time (min)
          </label>
          <input
            id="cookTime"
            name="cookTime"
            type="number"
            min={1}
            defaultValue={initialValues?.cookTime ?? undefined}
            placeholder="25"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="tags">
          Tags
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={joinTags(initialValues?.tags ?? null)}
          placeholder="Weeknight, Gluten-Free, Kid-Friendly"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="ingredients">
            Ingredients (one per line)
          </label>
          <textarea
            id="ingredients"
            name="ingredients"
            rows={8}
            defaultValue={joinLines(initialValues?.ingredients ?? null)}
            placeholder="2 tbsp olive oil\n1 lb chicken thighs\n1 tsp cumin"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700" htmlFor="instructions">
            Instructions (one per line)
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={8}
            defaultValue={joinLines(initialValues?.instructions ?? null)}
            placeholder="Preheat oven to 425F.\nToss chicken with spices.\nRoast 20 minutes."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700" htmlFor="notes">
          Notes (one per line)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={joinLines(initialValues?.notes ?? null)}
          placeholder="Note 1: Use freshly grated parmesan.\nNote 2: Slice mushrooms 1/2 cm thick."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform active:scale-95"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
