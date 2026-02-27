import RecipeLibraryClient from "@/components/recipes/RecipeLibraryClient";
import { listRecipes } from "@/lib/recipes";

import { createRecipe, importRecipeFromUrl } from "./actions";

export const revalidate = 30;

export default async function RecipesPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const importError = Array.isArray(resolvedSearchParams.importError)
    ? resolvedSearchParams.importError[0]
    : resolvedSearchParams.importError;

  const recipes = await listRecipes();
  const summaries = (recipes as Array<{ id: string; title: string; description?: string | null; imageUrl?: string | null; tags?: string[] | null; servings?: number | null; prepTime?: number | null; cookTime?: number | null; ingredientCount: number; sourceUrl?: string | null }>).map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    tags: recipe.tags ?? [],
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredientCount: recipe.ingredientCount,
    sourceUrl: recipe.sourceUrl ?? null,
  }));

  return (
    <RecipeLibraryClient
      recipes={summaries}
      createAction={createRecipe}
      importAction={importRecipeFromUrl}
      importError={importError}
    />
  );
}
