import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";

export async function listRecipes() {
  const householdId = await getDefaultHouseholdId();
  return prisma.recipe.findMany({
    where: { householdId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecipeById(recipeId: string) {
  const householdId = await getDefaultHouseholdId();
  return prisma.recipe.findFirst({
    where: { id: recipeId, householdId },
  });
}
