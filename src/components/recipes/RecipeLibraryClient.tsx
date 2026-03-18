"use client";

import dynamic from "next/dynamic";
import { useCallback, useId, useMemo, useRef, useState, useTransition } from "react";
import RecipeCard, { type RecipeSummary } from "@/components/recipes/RecipeCard";
import FadeContent from "@/components/ui/FadeContent";
import { useAccessibleDialog } from "@/components/ui/useAccessibleDialog";

const RecipeForm = dynamic(() => import("@/components/recipes/RecipeForm"), {
  loading: () => (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
      Loading recipe form...
    </div>
  ),
});

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
  importError?: string;
};

export default function RecipeLibraryClient({
  recipes,
  createAction,
  importAction,
  importError,
}: RecipeLibraryClientProps) {
  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selected, setSelected] = useState<"url" | "manual" | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [clientImportError, setClientImportError] = useState<string | null>(null);
  const [isImportPending, startImportTransition] = useTransition();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const addDialogTitleId = useId();
  const addDialogDescriptionId = useId();
  const searchInputId = useId();
  const urlInputId = useId();

  const closeAddDialog = useCallback(() => {
    setIsAddOpen(false);
    setSelected(null);
  }, []);

  const addDialogRef = useAccessibleDialog<HTMLDivElement>({
    isOpen: isAddOpen,
    onClose: closeAddDialog,
    initialFocusRef: closeButtonRef,
  });

  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      const haystack = normalize([recipe.title, recipe.description ?? "", (recipe.tags ?? []).join(" ")].join(" "));
      return haystack.includes(needle);
    });
  }, [query, recipes]);

  const importErrorMessage = useMemo(() => {
    if (!importError) {
      return null;
    }
    if (importError === "invalid_url") {
      return "Please enter a valid recipe URL.";
    }
    if (importError === "fetch_failed") {
      return "Could not fetch that URL. The site may block scraping or be unavailable.";
    }
    if (importError === "blocked") {
      return "That site blocked automated access. Try another URL or add the recipe manually.";
    }
    if (importError === "insufficient_steps") {
      return "We found ingredients but not enough instructions. You can still add this recipe manually.";
    }
    if (importError === "no_recipe_data") {
      return "No usable recipe data was found. Try another URL or add it manually.";
    }
    return "Recipe import failed. Please try again.";
  }, [importError]);

  const handleUrlImportSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setClientImportError(null);

    const formData = new FormData(event.currentTarget);

    startImportTransition(async () => {
      try {
        await importAction(formData);
      } catch (error) {
        const digest = (error as Error & { digest?: string })?.digest;
        if (digest?.startsWith("NEXT_REDIRECT")) {
          return;
        }
        setClientImportError("Import failed. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Your Recipes</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage and ingest recipes from URLs or manual entry.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAddOpen(true);
            setSelected(null);
          }}
          className="ui-button ui-button-primary ui-button-block active:translate-y-[1px]"
        >
          <span>Add Recipe</span>
        </button>
      </div>

      {importErrorMessage || clientImportError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {importErrorMessage ?? clientImportError}
        </div>
      ) : null}

      {isAddOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAddDialog();
            }
          }}
        >
          <div
            ref={addDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={addDialogTitleId}
            aria-describedby={addDialogDescriptionId}
            tabIndex={-1}
            className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl md:p-6 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 id={addDialogTitleId} className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Add a Recipe
                </h2>
                <p id={addDialogDescriptionId} className="text-sm text-slate-500 dark:text-slate-400">
                  Pick how you want to add a recipe.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeAddDialog}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                Close
              </button>
            </div>

            {!selected ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelected("url")}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-400"
                >
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Import from URL</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Paste a recipe link and we&apos;ll import it.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSelected("manual")}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left transition hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-400"
                >
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Manual Entry</h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Type the recipe in a structured form.
                  </p>
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                >
                  ← Back to options
                </button>

                {selected === "url" ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import from URL</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Drop in a recipe link and we&apos;ll import the full recipe when possible.
                      </p>
                    </div>
                    <form onSubmit={handleUrlImportSubmit} className="space-y-4">
                      <label htmlFor={urlInputId} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Recipe URL
                      </label>
                      <input
                        id={urlInputId}
                        type="url"
                        name="sourceUrl"
                        required
                        placeholder="https://example.com/recipe"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <button
                        type="submit"
                        disabled={isImportPending}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-70"
                      >
                        {isImportPending ? "Importing..." : "Import Recipe"}
                      </button>
                    </form>
                  </section>
                ) : null}

                {selected === "manual" ? (
                  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Manual Entry</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
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

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor={searchInputId}
                className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500"
              >
                Search
              </label>
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {filtered.length} of {recipes.length}
              </div>
            </div>
            <input
              id={searchInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recipes or tags"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-24 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 rounded-full bg-slate-50 p-4 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No recipes found</h3>
          <p className="mb-8 max-w-sm text-slate-500 dark:text-slate-400">Try adjusting your search or add a new recipe.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((recipe, index) => (
            <FadeContent key={recipe.id} delay={Math.min(index * 0.05, 0.3)}>
              <RecipeCard recipe={recipe} />
            </FadeContent>
          ))}
        </div>
      )}
    </div>
  );
}
