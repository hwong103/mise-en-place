import Link from "next/link";
import { notFound } from "next/navigation";

import RecipeForm from "@/components/recipes/RecipeForm";
import { getRecipeById } from "@/lib/recipes";
import { coerceStringArray } from "@/lib/recipe-utils";

import { updateRecipe } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({
  params,
}: {
  params: { recipeId: string };
}) {
  const recipe = await getRecipeById(params.recipeId);

  if (!recipe) {
    notFound();
  }

  const initialValues = {
    title: recipe.title,
    description: recipe.description ?? "",
    sourceUrl: recipe.sourceUrl ?? "",
    imageUrl: recipe.imageUrl ?? "",
    servings: recipe.servings ?? undefined,
    prepTime: recipe.prepTime ?? undefined,
    cookTime: recipe.cookTime ?? undefined,
    tags: recipe.tags ?? [],
    ingredients: coerceStringArray(recipe.ingredients),
    instructions: coerceStringArray(recipe.instructions),
    notes: coerceStringArray(recipe.notes),
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/recipes/${recipe.id}`} className="text-sm font-semibold text-indigo-600">
          Back to Recipe
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Edit Recipe
        </h1>
        <p className="text-slate-500">Update ingredients, instructions, and notes.</p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <RecipeForm
          action={updateRecipe}
          submitLabel="Save Changes"
          initialValues={initialValues}
          recipeId={recipe.id}
        />
      </section>
    </div>
  );
}
