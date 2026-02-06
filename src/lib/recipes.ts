import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";

const resolveHouseholdId = async (householdId?: string) =>
  householdId ?? getDefaultHouseholdId();

export async function listRecipes(householdId?: string) {
  const resolvedHouseholdId = await resolveHouseholdId(householdId);
  return prisma.recipe.findMany({
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
}

export async function listRecipeTitles(householdId?: string) {
  const resolvedHouseholdId = await resolveHouseholdId(householdId);
  return prisma.recipe.findMany({
    where: { householdId: resolvedHouseholdId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function getRecipeById(recipeId: string) {
  const householdId = await getDefaultHouseholdId();
  return prisma.recipe.findFirst({
    where: { id: recipeId, householdId },
  });
}
