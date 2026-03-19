import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import { readStringArray } from "@/lib/json-arrays";
import { logServerPerf } from "@/lib/server-perf";

const resolveHouseholdId = async (householdId?: string) =>
  householdId ?? getCurrentHouseholdId();

export async function listRecipes(householdId?: string) {
  const resolvedHouseholdId = await resolveHouseholdId(householdId);

  const startedAt = Date.now();
  try {
    const recipes = await prisma.recipe.findMany({
      where: { householdId: resolvedHouseholdId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        tags: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        ingredientCount: true,
        sourceUrl: true,
        cookCount: true,
      },
    });

    logServerPerf({
      phase: "recipes.list_read",
      route: "/recipes",
      startedAt,
      success: true,
      householdId: resolvedHouseholdId,
      meta: { result_count: recipes.length },
    });

    return recipes.map((recipe) => ({
      ...recipe,
      tags: readStringArray(recipe.tags),
    }));
  } catch (error) {
    logServerPerf({
      phase: "recipes.list_read",
      route: "/recipes",
      startedAt,
      success: false,
      householdId: resolvedHouseholdId,
      meta: { error: error instanceof Error ? error.message : "unknown_error" },
    });
    throw error;
  }
}

export async function listRecipeTitles(householdId?: string) {
  const resolvedHouseholdId = await resolveHouseholdId(householdId);
  return prisma.recipe.findMany({
    where: { householdId: resolvedHouseholdId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      cookCount: true,
    },
  });
}

export async function getRecipeById(recipeId: string) {
  const householdId = await getCurrentHouseholdId();

  const loadRecipe = async (hid: string, rid: string) => {
    const startedAt = Date.now();
    try {
      const recipe = await prisma.recipe.findFirst({
        where: { id: rid, householdId: hid },
      });

      logServerPerf({
        phase: "recipes.detail_read",
        route: "/recipes/[id]",
        startedAt,
        success: true,
        householdId: hid,
        meta: { recipe_id: rid, found: Boolean(recipe) },
      });

      return recipe
        ? {
            ...recipe,
            tags: readStringArray(recipe.tags),
          }
        : null;
    } catch (error) {
      logServerPerf({
        phase: "recipes.detail_read",
        route: "/recipes/[id]",
        startedAt,
        success: false,
        householdId: hid,
        meta: {
          recipe_id: rid,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
      throw error;
    }
  };

  if (process.env.NODE_ENV === "test") {
    return loadRecipe(householdId, recipeId);
  }

  const cachedQuery = unstable_cache(
    loadRecipe,
    ["recipe-detail", householdId, recipeId],
    {
      revalidate: 120,
      tags: [`recipe-${recipeId}`],
    }
  );

  return cachedQuery(householdId, recipeId);
}
