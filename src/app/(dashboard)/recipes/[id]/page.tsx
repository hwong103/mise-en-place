import Link from "next/link";
import { notFound } from "next/navigation";

import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import RecipeForm from "@/components/recipes/RecipeForm";
import { getRecipeById } from "@/lib/recipes";
import {
  coercePrepGroups,
  coerceStringArray,
  serializePrepGroupsToText,
} from "@/lib/recipe-utils";

import { deleteRecipe, updateRecipe, updateRecipeSection } from "../actions";

export const revalidate = 60;
export const dynamicParams = true;

const formatMinutes = (value?: number | null) =>
  value ? `${value} min` : null;

const getVideoEmbedUrl = (videoUrl?: string | null) => {
  if (!videoUrl) {
    return null;
  }

  try {
    const url = new URL(videoUrl);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (hostname.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }

    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
};

const getAuthorLabel = (sourceUrl?: string | null) => {
  if (!sourceUrl) {
    return null;
  }

  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const parts = hostname.split(".").filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return hostname;
  } catch {
    return null;
  }
};

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { id } = await params;
  const recipe = await getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  const ingredients = coerceStringArray(recipe.ingredients);
  const instructions = coerceStringArray(recipe.instructions);
  const notes = coerceStringArray(recipe.notes);
  const prepGroups = coercePrepGroups(recipe.prepGroups);
  const prepGroupsText = serializePrepGroupsToText(prepGroups);
  const authorLabel = getAuthorLabel(recipe.sourceUrl);
  const editParam = Array.isArray(searchParams?.edit)
    ? searchParams?.edit[0]
    : searchParams?.edit;
  const isEditing = editParam === "1" || editParam === "true";
  const embedUrl = getVideoEmbedUrl(recipe.videoUrl);
  const initialValues = {
    title: recipe.title,
    description: recipe.description ?? undefined,
    sourceUrl: recipe.sourceUrl ?? undefined,
    imageUrl: recipe.imageUrl ?? undefined,
    videoUrl: recipe.videoUrl ?? undefined,
    servings: recipe.servings ?? undefined,
    prepTime: recipe.prepTime ?? undefined,
    cookTime: recipe.cookTime ?? undefined,
    tags: recipe.tags ?? [],
    ingredients,
    instructions,
    notes,
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Link href="/recipes" className="text-sm font-semibold text-indigo-600">
            {"<- Back to Recipes"}
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            {recipe.title}
          </h1>
          {recipe.description ? (
            <p className="max-w-2xl text-slate-500">{recipe.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <AddToPlannerDialog recipeId={recipe.id} recipeTitle={recipe.title} />
          <Link
            href={
              isEditing
                ? `/recipes/${recipe.id}#edit-recipe`
                : `/recipes/${recipe.id}?edit=1#edit-recipe`
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Edit
          </Link>
          <form action={deleteRecipe}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <button
              type="submit"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {recipe.servings ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  {recipe.servings} servings
                </span>
              ) : null}
              {formatMinutes(recipe.prepTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  Prep {formatMinutes(recipe.prepTime)}
                </span>
              ) : null}
              {formatMinutes(recipe.cookTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                  Cook {formatMinutes(recipe.cookTime)}
                </span>
              ) : null}
              {recipe.sourceUrl ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600"
                >
                  {authorLabel ? `By ${authorLabel}` : "Source"}
                </a>
              ) : null}
            </div>

            {recipe.tags?.length ? (
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
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {recipe.videoUrl ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900">Watch</h2>
                  <a
                    href={recipe.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-indigo-600"
                  >
                    Open Video
                  </a>
                </div>
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                  {embedUrl ? (
                    <div className="aspect-[16/9] w-full">
                      <iframe
                        src={embedUrl}
                        title={`Video for ${recipe.title}`}
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-slate-500">
                      Video preview not available.
                    </div>
                  )}
                </div>
              </section>
            ) : null}
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Ingredients</h2>
              </div>
              {ingredients.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No ingredients listed yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {ingredients.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-6">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Edit Ingredients
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.125 19.588 3 21l1.412-4.125L16.862 3.487z" />
                  </svg>
                </summary>
                <form action={updateRecipeSection} className="mt-4 space-y-3">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="section" value="ingredients" />
                  <textarea
                    name="ingredients"
                    rows={6}
                    defaultValue={ingredients.join("\n")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Save Ingredients
                  </button>
                </form>
              </details>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Instructions</h2>
              </div>
              {instructions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No instructions listed yet.
                </p>
              ) : (
                <ol className="mt-4 space-y-3 text-sm text-slate-700">
                  {instructions.map((step, index) => (
                    <li key={`${index}-${step}`} className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              <details className="mt-6">
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Edit Instructions
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.125 19.588 3 21l1.412-4.125L16.862 3.487z" />
                  </svg>
                </summary>
                <form action={updateRecipeSection} className="mt-4 space-y-3">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="section" value="instructions" />
                  <textarea
                    name="instructions"
                    rows={6}
                    defaultValue={instructions.join("\n")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Save Instructions
                  </button>
                </form>
              </details>
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Notes</h2>
            {notes.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No notes saved yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {notes.map((note) => (
                  <li key={note} className="rounded-xl bg-slate-50 px-3 py-2">
                    {note}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-6">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Edit Notes
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.125 19.588 3 21l1.412-4.125L16.862 3.487z" />
                </svg>
              </summary>
              <form action={updateRecipeSection} className="mt-4 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="notes" />
                <textarea
                  name="notes"
                  rows={4}
                  defaultValue={notes.join("\n")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Save Notes
                </button>
              </form>
            </details>
          </section>
        </section>

        <aside className="space-y-6">
          {recipe.imageUrl ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Mise en Place</h2>
            {prepGroups.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Add ingredients to generate prep groups.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                {prepGroups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {group.title}
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {group.items.map((item) => (
                        <li key={`${group.title}-${item}`}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <details className="mt-6">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Edit Prep Groups
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.125 19.588 3 21l1.412-4.125L16.862 3.487z" />
                </svg>
              </summary>
              <form action={updateRecipeSection} className="mt-4 space-y-3">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="prepGroups" />
                <textarea
                  name="prepGroups"
                  rows={8}
                  defaultValue={prepGroupsText}
                  placeholder="Prep\n- mince garlic\n- chop onions"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
                >
                  Save Prep Groups
                </button>
              </form>
            </details>
          </section>
        </aside>
      </div>

      {isEditing ? (
        <section
          id="edit-recipe"
          className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Edit Recipe Details</h2>
            <p className="text-sm text-slate-500">
              Update the core recipe metadata, timings, and full ingredient list.
            </p>
          </div>
          <RecipeForm
            action={updateRecipe}
            initialValues={initialValues}
            recipeId={recipe.id}
            submitLabel="Save Recipe"
          />
        </section>
      ) : null}
    </div>
  );
}
