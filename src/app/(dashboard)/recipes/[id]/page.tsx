import Link from "next/link";
import { notFound } from "next/navigation";

import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import RecipeFocusMode from "@/components/recipes/RecipeFocusMode";
import SubmitButton from "@/components/forms/SubmitButton";
import { getRecipeById } from "@/lib/recipes";
import {
  cleanIngredientLine,
  coercePrepGroups,
  coerceStringArray,
} from "@/lib/recipe-utils";

import { deleteRecipe, updateRecipeSection } from "../actions";

export const revalidate = 60;
export const dynamicParams = true;

const formatMinutes = (value?: number | null) => (value ? `${value} min` : null);

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

    if (hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        const embedHost = hostname.endsWith("youtube-nocookie.com")
          ? "https://www.youtube-nocookie.com/embed/"
          : "https://www.youtube.com/embed/";
        return id ? `${embedHost}${id}` : null;
      }
    }

    if (hostname === "vimeo.com" || hostname === "player.vimeo.com" || hostname.endsWith(".vimeo.com")) {
      const idMatch = url.pathname.match(/(\d+)/);
      const id = idMatch ? idMatch[1] : null;
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

const isIngredientGroupTitle = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (/(^|\b)(prep|preparation)\b/.test(normalized)) {
    return false;
  }
  if (/^step\s+\d+/.test(normalized)) {
    return false;
  }
  return true;
};

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const recipe = await getRecipeById(id);

  if (!recipe) {
    notFound();
  }

  const ingredients = coerceStringArray(recipe.ingredients)
    .map((line) => cleanIngredientLine(line).line)
    .filter(Boolean);
  const instructions = coerceStringArray(recipe.instructions);
  const notes = coerceStringArray(recipe.notes);
  const prepGroups = coercePrepGroups(recipe.prepGroups);
  const ingredientGroups = (() => {
    if (!prepGroups.length) {
      return [];
    }
    const candidates = prepGroups.filter((group) => isIngredientGroupTitle(group.title));
    if (!candidates.length) {
      return [];
    }
    const ingredientSet = new Set(ingredients);
    const groupedItems = new Set<string>();
    const filtered = candidates
      .map((group) => ({
        title: group.title,
        items: group.items
          .map((item) => cleanIngredientLine(item).line)
          .filter(Boolean)
          .filter((item) => ingredientSet.has(item)),
      }))
      .filter((group) => group.items.length > 0);

    filtered.forEach((group) => group.items.forEach((item) => groupedItems.add(item)));
    const remaining = ingredients.filter((item) => !groupedItems.has(item));
    if (remaining.length > 0) {
      filtered.push({ title: "Other Ingredients", items: remaining });
    }
    return filtered;
  })();
  const authorLabel = getAuthorLabel(recipe.sourceUrl);
  const embedUrl = getVideoEmbedUrl(recipe.videoUrl);
  const editParam = Array.isArray(resolvedSearchParams.edit)
    ? resolvedSearchParams.edit[0]
    : resolvedSearchParams.edit;
  const isEditing = editParam === "1" || editParam === "true";

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-sm dark:border-slate-800">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/50 via-slate-900/55 to-slate-950/85" />
        <div className="relative flex min-h-[260px] flex-col justify-between p-5 md:min-h-[320px] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Link
              href="/recipes"
              className="rounded-xl border border-white/40 bg-slate-900/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-slate-900/65"
            >
              {"<- Back to Recipes"}
            </Link>
            <div className="flex flex-wrap justify-end gap-2">
              <AddToPlannerDialog recipeId={recipe.id} recipeTitle={recipe.title} />
              <RecipeFocusMode title={recipe.title} prepGroups={prepGroups} ingredients={ingredients} instructions={instructions} />
              <Link
                href={
                  isEditing
                    ? `/recipes/${recipe.id}`
                    : `/recipes/${recipe.id}?edit=1`
                }
                className="rounded-xl border border-white/40 bg-slate-900/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-slate-900/65"
              >
                {isEditing ? "Done" : "Edit"}
              </Link>
              <form action={deleteRecipe}>
                <input type="hidden" name="recipeId" value={recipe.id} />
                <SubmitButton
                  label="Delete"
                  pendingLabel="Deleting..."
                  className="rounded-xl border border-rose-200/80 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 backdrop-blur-sm transition-colors hover:bg-rose-500/25 disabled:opacity-70"
                />
              </form>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {recipe.title}
            </h1>
            {recipe.description ? (
              <p className="max-w-3xl text-slate-100/95 md:text-lg">{recipe.description}</p>
            ) : null}
          </div>
        </div>
      </section>

      {recipe.videoUrl ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:hidden dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Watch</h2>
            <a href={recipe.videoUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              Open Video
            </a>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
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
              <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                Video preview not available.
              </div>
            )}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ingredients</h2>
              {ingredients.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No ingredients listed yet.</p>
              ) : ingredientGroups.length > 0 ? (
                <div className="mt-4 space-y-5">
                  {ingredientGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{group.title}</h3>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                        {group.items.map((item) => (
                          <li key={`${group.title}-${item}`} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                  {ingredients.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {isEditing ? (
                <form action={updateRecipeSection} className="mt-6 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                  <input type="hidden" name="recipeId" value={recipe.id} />
                  <input type="hidden" name="section" value="ingredients" />
                  <textarea
                    name="ingredients"
                    rows={6}
                    defaultValue={ingredients.join("\n")}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                    Save Ingredients
                  </button>
                </form>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Instructions</h2>
              {instructions.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No instructions listed yet.</p>
              ) : (
                <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                  {instructions.map((step, index) => (
                    <li key={`${index}-${step}`} className="flex gap-3">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              {isEditing ? (
                <form action={updateRecipeSection} className="mt-6 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="instructions" />
                <textarea
                  name="instructions"
                  rows={6}
                  defaultValue={instructions.join("\n")}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                  Save Instructions
                </button>
                </form>
              ) : null}
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Notes</h2>
            {notes.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No notes saved yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {notes.map((note) => (
                  <li key={note} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    {note}
                  </li>
                ))}
              </ul>
            )}
            {isEditing ? (
              <form action={updateRecipeSection} className="mt-6 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <input type="hidden" name="recipeId" value={recipe.id} />
              <input type="hidden" name="section" value="notes" />
              <textarea
                name="notes"
                rows={4}
                defaultValue={notes.join("\n")}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                Save Notes
              </button>
              </form>
            ) : null}
          </section>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3">
              {recipe.servings ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {recipe.servings} servings
                </span>
              ) : null}
              {formatMinutes(recipe.prepTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Prep {formatMinutes(recipe.prepTime)}
                </span>
              ) : null}
              {formatMinutes(recipe.cookTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Cook {formatMinutes(recipe.cookTime)}
                </span>
              ) : null}
              {recipe.sourceUrl ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
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
                    className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {isEditing ? (
              <form action={updateRecipeSection} className="mt-6 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="section" value="overview" />
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Inline Edit</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Title
                    <input
                      name="title"
                      defaultValue={recipe.title}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Tags
                    <input
                      name="tags"
                      defaultValue={(recipe.tags ?? []).join(", ")}
                      placeholder="Weeknight, Family"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Servings
                    <input
                      name="servings"
                      type="number"
                      min={1}
                      defaultValue={recipe.servings ?? undefined}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Prep (min)
                      <input
                        name="prepTime"
                        type="number"
                        min={1}
                        defaultValue={recipe.prepTime ?? undefined}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Cook (min)
                      <input
                        name="cookTime"
                        type="number"
                        min={1}
                        defaultValue={recipe.cookTime ?? undefined}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
                    Description
                    <textarea
                      name="description"
                      rows={2}
                      defaultValue={recipe.description ?? ""}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input
                    name="sourceUrl"
                    defaultValue={recipe.sourceUrl ?? ""}
                    placeholder="Source URL"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    name="videoUrl"
                    defaultValue={recipe.videoUrl ?? ""}
                    placeholder="Video URL"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    name="imageUrl"
                    defaultValue={recipe.imageUrl ?? ""}
                    placeholder="Image URL"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white">
                  Save Overview
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <aside className="space-y-6">
          {recipe.videoUrl ? (
            <section className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:block dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Watch</h2>
                <a href={recipe.videoUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Open Video
                </a>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
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
                  <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                    Video preview not available.
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
