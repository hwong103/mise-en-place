import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getCurrentHouseholdId } from "@/lib/household";
import { logServerPerf } from "@/lib/server-perf";

const resolveHouseholdId = async (householdId?: string) =>
  householdId ?? getCurrentHouseholdId();

export async function listRecipes(householdId?: string) {
  const resolvedHouseholdId = await resolveHouseholdId(householdId);

  const cachedQuery = unstable_cache(
    async (hid: string) => {
      const startedAt = Date.now();
      try {
        const recipes = await prisma.recipe.findMany({
          where: { householdId: hid },
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
          },
        });

        logServerPerf({
          phase: "recipes.list_read",
          route: "/recipes",
          startedAt,
          success: true,
          householdId: hid,
          meta: { result_count: recipes.length },
        });

        return recipes;
      } catch (error) {
        logServerPerf({
          phase: "recipes.list_read",
          route: "/recipes",
          startedAt,
          success: false,
          householdId: hid,
          meta: { error: error instanceof Error ? error.message : "unknown_error" },
        });
        throw error;
      }
    },
    ["recipes-list", resolvedHouseholdId],
    {
      revalidate: 60,
      tags: [`recipes-${resolvedHouseholdId}`],
    }
  );

  return cachedQuery(resolvedHouseholdId);
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
  const householdId = await getCurrentHouseholdId();

  const cachedQuery = unstable_cache(
    async (hid: string, rid: string) => {
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

        return recipe;
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
    },
    ["recipe-detail", householdId, recipeId],
    {
      revalidate: 120,
      tags: [`recipe-${recipeId}`],
    }
  );

  return cachedQuery(householdId, recipeId);
}
