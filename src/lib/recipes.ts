import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { logServerPerf } from "@/lib/server-perf";

const resolveHouseholdId = async (householdId?: string) =>
  householdId ?? getCurrentHouseholdId();

export async function listRecipes(householdId?: string) {
  const startedAt = Date.now();
  let resolvedHouseholdId: string | undefined;
  try {
    resolvedHouseholdId = await resolveHouseholdId(householdId);
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
        ingredients: true,
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

    return recipes;
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
    },
  });
}

export async function getRecipeById(recipeId: string) {
  const startedAt = Date.now();
  let householdId: string | undefined;
  try {
    householdId = await getCurrentHouseholdId();
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, householdId },
      select: {
        id: true,
        householdId: true,
        title: true,
        description: true,
        imageUrl: true,
        videoUrl: true,
        sourceUrl: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        ingredients: true,
        instructions: true,
        notes: true,
        prepGroups: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logServerPerf({
      phase: "recipes.detail_read",
      route: "/recipes/[id]",
      startedAt,
      success: true,
      householdId,
      meta: { recipe_id: recipeId, found: Boolean(recipe) },
    });

    return recipe;
  } catch (error) {
    logServerPerf({
      phase: "recipes.detail_read",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      householdId,
      meta: {
        recipe_id: recipeId,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }
}
