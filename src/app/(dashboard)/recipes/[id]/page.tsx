import Link from "next/link";
import { notFound } from "next/navigation";

import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import LineListEditor from "@/components/recipes/LineListEditor";
import RecipeFocusMode from "@/components/recipes/RecipeFocusMode";
import UnsavedBadge from "@/components/recipes/UnsavedBadge";
import SubmitButton from "@/components/forms/SubmitButton";
import { getRecipeById } from "@/lib/recipes";
import { getServerNow } from "@/lib/server-clock";
import { logServerPerf } from "@/lib/server-perf";
import {
  cleanIngredientLine,
  coercePrepGroups,
  coerceStringArray,
} from "@/lib/recipe-utils";

import { deleteRecipe, updateRecipeSection } from "../detail-actions";

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
  const startedAt = getServerNow();
  const paramsResolveStartedAt = getServerNow();
  const { id } = await params;
  const paramsResolveMs = getServerNow() - paramsResolveStartedAt;

  const searchParamsResolveStartedAt = getServerNow();
  const resolvedSearchParams = (await searchParams) ?? {};
  const searchParamsResolveMs = getServerNow() - searchParamsResolveStartedAt;

  const recipeReadStartedAt = getServerNow();
  const recipe = await getRecipeById(id);
  const recipeReadMs = getServerNow() - recipeReadStartedAt;

  if (!recipe) {
    logServerPerf({
      phase: "recipes.detail_route_render",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      meta: {
        recipe_id: id,
        reason: "not_found",
        params_resolve_ms: paramsResolveMs,
        search_params_resolve_ms: searchParamsResolveMs,
        recipe_read_ms: recipeReadMs,
      },
    });
    notFound();
  }

  const transformStartedAt = getServerNow();
  const ingredients = coerceStringArray(recipe.ingredients)
    .map((line) => cleanIngredientLine(line).line)
    .filter(Boolean);
  const instructions = coerceStringArray(recipe.instructions);
  const notes = coerceStringArray(recipe.notes);
  const prepGroups = coercePrepGroups(recipe.prepGroups);

  // Source-faithful ingredient groups: groups explicitly flagged as sourceGroup,
  // or (for legacy data) those whose titles pass isIngredientGroupTitle (section headers from import).
  const ingredientGroups = (() => {
    if (!prepGroups.length) {
      return [];
    }
    const candidates = prepGroups.filter(
      (group) => group.sourceGroup === true || (!Object.prototype.hasOwnProperty.call(group, "sourceGroup") && isIngredientGroupTitle(group.title))
    );
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

  // Mise prep groups: instruction-derived groups (not source section headers).
  // Sorted by stepIndex when available.
  const miseGroups = (() => {
    const candidates = prepGroups.filter(
      (group) => group.sourceGroup !== true && !isIngredientGroupTitle(group.title)
    );
    if (candidates.length === 0) {
      // Fall back to all prepGroups if none are instruction-derived
      return prepGroups.filter((g) => g.sourceGroup !== true);
    }
    return [...candidates].sort((a, b) => {
      if (a.stepIndex !== undefined && b.stepIndex !== undefined) {
        return a.stepIndex - b.stepIndex;
      }
      if (a.stepIndex !== undefined) return -1;
      if (b.stepIndex !== undefined) return 1;
      return 0;
    });
  })();
  const authorLabel = getAuthorLabel(recipe.sourceUrl);
  const embedUrl = getVideoEmbedUrl(recipe.videoUrl);
  const editParam = Array.isArray(resolvedSearchParams.edit)
    ? resolvedSearchParams.edit[0]
    : resolvedSearchParams.edit;
  const isEditing = editParam === "1" || editParam === "true";
  const transformMs = getServerNow() - transformStartedAt;

  logServerPerf({
    phase: "recipes.detail_route_render",
    route: "/recipes/[id]",
    startedAt,
    success: true,
    householdId: recipe.householdId,
    meta: {
      recipe_id: id,
      params_resolve_ms: paramsResolveMs,
      search_params_resolve_ms: searchParamsResolveMs,
      recipe_read_ms: recipeReadMs,
      transform_ms: transformMs,
      ingredient_count: ingredients.length,
      instruction_count: instructions.length,
    },
  });

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
          <div className="flex items-start justify-between gap-3">
            <Link
              href="/recipes"
              className="rounded-xl border border-white/40 bg-slate-900/45 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm hover:bg-slate-900/65"
            >
              <span className="md:hidden">{"<- Back"}</span>
              <span className="hidden md:inline">{"<- Back to Recipes"}</span>
            </Link>
            <div className="relative z-[3] flex items-center gap-1.5 md:absolute md:right-6 md:top-5 md:gap-2">
              <div className="hidden md:block">
                <AddToPlannerDialog
                  recipeId={recipe.id}
                  recipeTitle={recipe.title}
                  triggerLabel="+ Add to Planner"
                  triggerClassName="rounded-[20px] border border-white/15 bg-white/10 px-[14px] py-[7px] text-xs font-medium text-white/60 transition-colors hover:bg-white/15 hover:text-white/85"
                />
              </div>
              <RecipeFocusMode
                title={recipe.title}
                recipeId={recipe.id}
                prepGroups={miseGroups}
                ingredients={ingredients}
                instructions={instructions}
                notes={notes}
                triggerWrapperClassName="contents"
                miseButtonClassName="rounded-[20px] border-[1.5px] border-white/60 bg-transparent px-[18px] py-2 text-[13px] font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
                cookButtonClassName="rounded-[20px] border-0 bg-[#C67B2A] px-[18px] py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(198,123,42,0.35)] transition-colors hover:bg-[#B56E24]"
                showCookPlayIcon
              />
              <details className="group relative">
                <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-white/15 bg-white/10 text-lg leading-none text-white/55 transition-colors hover:bg-white/15 hover:text-white [&::-webkit-details-marker]:hidden">
                  &middot;&middot;&middot;
                </summary>
                <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="md:hidden">
                    <AddToPlannerDialog
                      recipeId={recipe.id}
                      recipeTitle={recipe.title}
                      triggerLabel="Add to Planner"
                      triggerClassName="block w-full px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    />
                  </div>
                  <Link
                    href={
                      isEditing
                        ? `/recipes/${recipe.id}`
                        : `/recipes/${recipe.id}?edit=1`
                    }
                    className="block px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </Link>
                  <form action={deleteRecipe}>
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <SubmitButton
                      label="Delete"
                      pendingLabel="Deleting..."
                      className="block w-full px-3 py-2 text-left text-sm font-medium text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 disabled:opacity-70"
                    />
                  </form>
                </div>
              </details>
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

      <form id="recipe-edit-form" action={updateRecipeSection} className="space-y-6">
        {isEditing ? (
          <>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="section" value="all" />
            <div className="sticky top-4 z-10 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Editing recipe
              </span>
              <div className="flex gap-2">
                <UnsavedBadge formId="recipe-edit-form" />
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Cancel
                </Link>
                <SubmitButton
                  label="Save All Changes"
                  pendingLabel="Saving..."
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ingredients</h2>
                {!isEditing ? (
                  ingredients.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      No ingredients listed yet.
                    </p>
                  ) : ingredientGroups.length > 0 ? (
                    <div className="mt-4 space-y-5">
                      {ingredientGroups.map((group) => (
                        <div key={group.title}>
                          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            {group.title}
                          </h3>
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
                  )
                ) : (
                  <LineListEditor
                    name="ingredients"
                    initialItems={ingredients}
                    ordered={false}
                    placeholder="e.g. 2 tbsp olive oil"
                    addLabel="+ Add ingredient"
                  />
                )}
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Instructions</h2>
                {!isEditing ? (
                  instructions.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      No instructions listed yet.
                    </p>
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
                  )
                ) : (
                  <LineListEditor
                    name="instructions"
                    initialItems={instructions}
                    ordered
                    placeholder="Describe this step..."
                    addLabel="+ Add step"
                  />
                )}
              </section>
            </div>

            {miseGroups.length > 0 ? (
              <section className="rounded-3xl border border-amber-100 bg-white p-6 shadow-sm dark:border-amber-900/30 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Mise Prep Groups</h2>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
                    Mise en place
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Prep groups derived from instructions — what to prepare before you cook.
                </p>
                {!isEditing ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {miseGroups.map((group) => (
                      <div key={group.title} className="relative rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
                        {group.stepIndex !== undefined ? (
                          <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Step {group.stepIndex + 1}
                          </span>
                        ) : null}
                        <h3 className="pr-16 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          {group.title}
                        </h3>
                        <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                          {group.items.map((item) => (
                            <li key={`${group.title}-${item}`} className="flex items-start gap-2">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400 dark:bg-amber-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <textarea
                      name="prepGroupsText"
                      rows={Math.max(6, miseGroups.reduce((acc, g) => acc + g.items.length + 2, 0))}
                      defaultValue={miseGroups.map((g) => `${g.title}\n${g.items.map((i) => `- ${i}`).join("\n")}`).join("\n\n")}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      placeholder="Group Title&#10;- ingredient one&#10;- ingredient two&#10;&#10;Another Group&#10;- ingredient three"
                    />
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Each group starts with a title line, followed by items prefixed with <code>-</code>.
                    </p>
                  </div>
                )}
              </section>
            ) : null}
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {!isEditing ? (
                <>
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
                      {recipe.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Inline Edit
                  </p>
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
                </div>
              )}
            </div>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Notes</h2>
              {!isEditing ? (
                notes.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No notes saved yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {notes.map((note) => (
                      <li key={note} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        {note}
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <LineListEditor
                  name="notes"
                  initialItems={notes}
                  ordered={false}
                  placeholder="Add a note..."
                  addLabel="+ Add note"
                />
              )}
            </section>

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
      </form>
    </div>
  );
}
