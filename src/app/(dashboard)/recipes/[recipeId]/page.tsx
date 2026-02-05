import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteRecipe, updateRecipeSection } from "../actions";
import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import { getRecipeById } from "@/lib/recipes";
import { coercePrepGroups, coerceStringArray, serializePrepGroupsToText } from "@/lib/recipe-utils";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({
  params,
}: {
  params: { recipeId: string };
}) {
  const recipe = await getRecipeById(params.recipeId);

  if (!recipe) {
    notFound();
  }

  const ingredients = coerceStringArray(recipe.ingredients);
  const instructions = coerceStringArray(recipe.instructions);
  const prepGroups = coercePrepGroups(recipe.prepGroups);
  const notes = coerceStringArray(recipe.notes);
  const joinLines = (lines: string[]) => (lines.length ? lines.join("\n") : "");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/recipes" className="text-sm font-semibold text-indigo-600">
            Back to Recipes
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{recipe.title}</h1>
          {recipe.description ? (
            <p className="mt-2 text-slate-500">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AddToPlannerDialog recipeId={recipe.id} recipeTitle={recipe.title} />
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Edit Recipe
          </Link>
          <form action={deleteRecipe}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <button
              type="submit"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600"
            >
              Delete Recipe
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {recipe.imageUrl ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipe.imageUrl} alt="" className="h-72 w-full object-cover" />
            </div>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Instructions</h2>
            {instructions.length > 0 ? (
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-600">
                {instructions.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No instructions added yet.</p>
            )}

            <details className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                Edit Instructions
              </summary>
              <form action={updateRecipeSection} className="mt-3 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="instructions" />
                <textarea
                  name="instructions"
                  rows={8}
                  defaultValue={joinLines(instructions)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Instructions
                </button>
              </form>
            </details>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Details</h2>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {recipe.servings ? <li>Servings: {recipe.servings}</li> : null}
              {recipe.prepTime ? <li>Prep time: {recipe.prepTime} min</li> : null}
              {recipe.cookTime ? <li>Cook time: {recipe.cookTime} min</li> : null}
              {recipe.sourceUrl ? (
                <li>
                  Source: <a className="text-indigo-600" href={recipe.sourceUrl}>{recipe.sourceUrl}</a>
                </li>
              ) : null}
            </ul>

            {recipe.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {recipe.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Ingredients</h2>
            {ingredients.length > 0 ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600">
                {ingredients.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No ingredients added yet.</p>
            )}

            <details className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                Edit Ingredients
              </summary>
              <form action={updateRecipeSection} className="mt-3 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="ingredients" />
                <textarea
                  name="ingredients"
                  rows={8}
                  defaultValue={joinLines(ingredients)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Ingredients
                </button>
              </form>
            </details>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Notes</h2>
            {notes.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {notes.map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No notes added yet.</p>
            )}

            <details className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                Edit Notes
              </summary>
              <form action={updateRecipeSection} className="mt-3 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="notes" />
                <textarea
                  name="notes"
                  rows={6}
                  defaultValue={joinLines(notes)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Notes
                </button>
              </form>
            </details>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">Mise en Place</h2>
            {prepGroups.length > 0 ? (
              <div className="mt-4 space-y-4">
                {prepGroups.map((group) => (
                  <div key={group.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold text-slate-700">{group.title}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">No prep groups defined yet.</p>
            )}

            <details className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                Edit Mise en Place
              </summary>
              <form action={updateRecipeSection} className="mt-3 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="prepGroups" />
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Format:</strong> Group names on their own line. Items start with a dash (-).
                  </p>
                </div>
                <textarea
                  name="prepGroups"
                  rows={8}
                  defaultValue={serializePrepGroupsToText(prepGroups)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save Mise en Place
                </button>
              </form>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
