import Link from "next/link";

import RecipeCard from "@/components/recipes/RecipeCard";
import RecipeForm from "@/components/recipes/RecipeForm";
import OcrImportCard from "@/components/recipes/OcrImportCard";
import { listRecipes } from "@/lib/recipes";

import { createRecipe, importRecipeFromUrl } from "./actions";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
    const recipes = await listRecipes();

    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Recipes</h1>
                    <p className="text-slate-500">Manage and ingest recipes from books, URLs, or manual entry.</p>
                </div>
                <Link href="#add-recipe" className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg transition-transform active:scale-95">
                    <span>Add Recipe</span>
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr_1.4fr]">
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Import from URL</h2>
                        <p className="text-sm text-slate-500">
                            Drop in a recipe link to create a quick placeholder entry.
                        </p>
                    </div>
                    <form action={importRecipeFromUrl} className="space-y-4">
                        <input
                            type="url"
                            name="sourceUrl"
                            required
                            placeholder="https://example.com/recipe"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <button
                            type="submit"
                            className="w-full rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
                        >
                            Import Recipe
                        </button>
                    </form>
                </section>

                <OcrImportCard />

                <section id="add-recipe" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-900">Add a New Recipe</h2>
                        <p className="text-sm text-slate-500">
                            Create a manual entry to get started. OCR and URL tools can come next.
                        </p>
                    </div>
                    <RecipeForm action={createRecipe} submitLabel="Add Recipe" />
                </section>
            </div>

            {recipes.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center">
                    <div className="mb-6 rounded-full bg-slate-50 p-4 text-slate-400">
                        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">No recipes yet</h3>
                    <p className="mb-8 max-w-sm text-slate-500">Start by creating your first manual recipe entry above.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>
            )}
        </div>
    );
}
