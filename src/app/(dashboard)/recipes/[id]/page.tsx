import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";

import AddToPlannerDialog from "@/components/recipes/AddToPlannerDialog";
import SubmitButton from "@/components/forms/SubmitButton";
import RecipeDetailTabs from "@/components/recipes/RecipeDetailTabs";
import { getRecipeById } from "@/lib/recipes";
import { getServerNow } from "@/lib/server-clock";
import { logServerPerf } from "@/lib/server-perf";
import {
  coercePrepGroups,
  coerceStringArray,
  getRecipeIngredientLines,
} from "@/lib/recipe-utils";

import { deleteRecipe, updateRecipeSection } from "../detail-actions";

const RecipeFocusMode = dynamic(() => import("@/components/recipes/RecipeFocusMode"));

export const revalidate = 0;
export const dynamicParams = true;

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
  const ingredients = getRecipeIngredientLines(recipe.ingredients, recipe.prepGroups);
  const instructions = coerceStringArray(recipe.instructions);
  const notes = coerceStringArray(recipe.notes);
  const prepGroups = coercePrepGroups(recipe.prepGroups);

  // Ingredient groups (sourceGroup=true) for the Ingredients card with headers
  const ingredientGroups = (() => {
    const sourceGroups = prepGroups.filter((g) => g.sourceGroup);
    if (sourceGroups.length > 0) return sourceGroups;
    if (ingredients.length > 0) {
      return [{ title: "", items: ingredients }];
    }
    return [];
  })();

  // Mise prep groups (sourceGroup=false) for the Prep Groups card and Mise Focus
  const miseGroups = prepGroups.filter((g) => !g.sourceGroup);

  const editParam = Array.isArray(resolvedSearchParams.edit)
    ? resolvedSearchParams.edit[0]
    : resolvedSearchParams.edit;
  const isEditing = editParam === "1" || editParam === "true";

  const authorLabel = getAuthorLabel(recipe.sourceUrl);
  const embedUrl = getVideoEmbedUrl(recipe.videoUrl);
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
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1200px"
            className="object-cover"
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
            <div id="heroActions" className="relative z-[3] flex flex-wrap items-center gap-1.5 md:absolute md:right-6 md:top-5 md:gap-2">
              <div className="hidden md:block">
                <AddToPlannerDialog
                  recipeId={recipe.id}
                  recipeTitle={recipe.title}
                  triggerLabel="+ Add to Planner"
                  triggerClassName="rounded-[20px] border border-white/15 bg-white/10 px-[14px] py-[7px] text-xs font-medium text-white/60 transition-colors hover:bg-white/15 hover:text-white/85"
                />
              </div>
              <RecipeFocusMode
                recipeId={recipe.id}
                title={recipe.title}
                prepGroups={prepGroups}
                ingredientGroups={ingredientGroups}
                instructions={instructions}
                notes={notes}
                triggerWrapperClassName="contents"
                miseButtonClassName="btn-mise"
                cookButtonClassName="btn-cook"
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
                    {isEditing ? "Cancel" : "Edit"}
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

      <form id="recipe-edit-form" action={updateRecipeSection} className="space-y-6">
        {isEditing ? (
          <>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <input type="hidden" name="section" value="all" />
            <div className="sticky top-4 z-50 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 shadow-md backdrop-blur-md dark:border-emerald-900/50 dark:bg-emerald-950/80">
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Editing recipe
              </span>
              <div className="flex gap-2">
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

        <RecipeDetailTabs
          ingredientGroups={ingredientGroups}
          miseGroups={miseGroups}
          instructions={instructions}
          notes={notes}
          embedUrl={embedUrl}
          videoUrl={recipe.videoUrl}
          servings={recipe.servings}
          cookCount={recipe.cookCount}
          prepTime={recipe.prepTime}
          cookTime={recipe.cookTime}
          sourceUrl={recipe.sourceUrl}
          authorLabel={authorLabel}
          tags={recipe.tags ?? []}
          description={recipe.description}
          imageUrl={recipe.imageUrl}
          isEditing={isEditing}
          recipeTitle={recipe.title}
        />
      </form >
    </div >
  );
}
