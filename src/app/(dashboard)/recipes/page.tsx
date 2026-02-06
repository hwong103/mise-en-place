import RecipeLibraryClient from "@/components/recipes/RecipeLibraryClient";
import { listRecipes } from "@/lib/recipes";
import { coerceStringArray } from "@/lib/recipe-utils";

import { createRecipe, importRecipeFromUrl } from "./actions";

export const revalidate = 30;

export default async function RecipesPage() {
  const recipes = await listRecipes();
  const summaries = recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    tags: recipe.tags ?? [],
    servings: recipe.servings,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    ingredientCount: coerceStringArray(recipe.ingredients).length,
  }));

  return (
    <RecipeLibraryClient
      recipes={summaries}
      createAction={createRecipe}
      importAction={importRecipeFromUrl}
    />
  );
}
