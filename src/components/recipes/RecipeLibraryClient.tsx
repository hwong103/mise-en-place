"use client";

import { useMemo, useState } from "react";
import RecipeCard, { type RecipeSummary } from "@/components/recipes/RecipeCard";
import RecipeForm from "@/components/recipes/RecipeForm";
import OcrImportCard from "@/components/recipes/OcrImportCard";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type RecipeLibraryClientProps = {
  recipes: RecipeSummary[];
  createAction: (formData: FormData) => Promise<void>;
  importAction: (formData: FormData) => Promise<void>;
};

export default function RecipeLibraryClient({
  recipes,
  createAction,
  importAction,
}: RecipeLibraryClientProps) {
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selected, setSelected] = useState<"url" | "photo" | "manual" | null>(null);

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      const haystack = normalize([
        recipe.title,
        recipe.description ?? "",
        (recipe.tags ?? []).join(" "),
      ].join(" "));
      return haystack.includes(needle);
    });
  }, [query, recipes]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Recipes</h1>
          <p className="text-slate-500">Manage and ingest recipes from books, URLs, or manual entry.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAddOpen(true);
            setSelected(null);
          }}
          className="flex items-center space-x-2 rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg transition-transform active:scale-95"
        >
          <span>Add Recipe</span>
        </button>
      </div>

      {isAddOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Add a Recipe</h2>
                <p className="text-sm text-slate-500">Pick how you want to add a recipe.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setSelected(null);
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-500"
              >
                Close
              </button>
            </div>

            {!selected ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSelected("url")}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-indigo-300"
                >
                  <h3 className="text-lg font-bold text-slate-900">Import from URL</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Paste a recipe link and we&apos;ll import it.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelected("photo")}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-indigo-300"
                >
                  <h3 className="text-lg font-bold text-slate-900">Take a Photo</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Upload a cookbook photo and extract the text.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelected("manual")}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-indigo-300"
                >
                  <h3 className="text-lg font-bold text-slate-900">Manual Entry</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Type the recipe in a structured form.
                  </p>
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm font-semibold text-indigo-600"
                >
                  ← Back to options
                </button>

                {selected === "url" ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Import from URL</h3>
                      <p className="text-sm text-slate-500">
                        Drop in a recipe link to create a quick placeholder entry.
                      </p>
                    </div>
                    <form action={importAction} className="space-y-4">
                      <input
                        type="url"
                        name="sourceUrl"
                        required
                        placeholder="https://example.com/recipe"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
                      >
                        Import Recipe
                      </button>
                    </form>
                  </section>
                ) : null}

                {selected === "photo" ? <OcrImportCard /> : null}

                {selected === "manual" ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900">Manual Entry</h3>
                      <p className="text-sm text-slate-500">
                        Create a manual entry to get started.
                      </p>
                    </div>
                    <RecipeForm action={createAction} submitLabel="Add Recipe" />
                  </section>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-400">Search</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recipes or tags"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {filtered.length} of {recipes.length}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center">
          <div className="mb-6 rounded-full bg-slate-50 p-4 text-slate-400">
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900">No recipes found</h3>
          <p className="mb-8 max-w-sm text-slate-500">Try adjusting your search or add a new recipe.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
