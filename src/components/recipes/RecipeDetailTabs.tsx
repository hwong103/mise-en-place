"use client";

import { useEffect, useState, type ReactNode } from "react";

import IngredientGroupsEditor from "@/components/recipes/IngredientGroupsEditor";
import LineListEditor from "@/components/recipes/LineListEditor";

type RecipeGroup = {
  title: string;
  items: string[];
};

type RecipeDetailTabsProps = {
  ingredientGroups: RecipeGroup[];
  miseGroups: RecipeGroup[];
  instructions: string[];
  notes: string[];
  embedUrl: string | null;
  videoUrl: string | null;
  servings?: number | null;
  cookCount?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  sourceUrl?: string | null;
  authorLabel?: string | null;
  tags?: string[];
  description?: string | null;
  imageUrl?: string | null;
  isEditing: boolean;
  recipeTitle: string;
};

type LeftTab = "ingredients" | "prepGroups";
type RightTab = "instructions" | "notes" | "watch";

const LEFT_TAB_KEY = "recipe-detail-left-tab";
const RIGHT_TAB_KEY = "recipe-detail-right-tab";

const formatMinutes = (value?: number | null) => (value ? `${value} min` : null);

const isLeftTab = (value: string | null): value is LeftTab =>
  value === "ingredients" || value === "prepGroups";

const isRightTab = (value: string | null): value is RightTab =>
  value === "instructions" || value === "notes" || value === "watch";

export const getVisibleRightTab = (rightTab: RightTab, videoUrl?: string | null): RightTab => {
  if (!videoUrl && rightTab === "watch") {
    return "instructions";
  }

  return rightTab;
};

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`border-b-2 px-0 py-2 text-sm transition-colors ${
        active
          ? "border-emerald-500 font-semibold text-slate-900 dark:text-slate-100"
          : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function LeftView({ groups }: { groups: RecipeGroup[] }) {
  return (
    <div className="space-y-6">
      {groups.map((group, groupIdx) => (
        <div key={`${group.title || "group"}-${groupIdx}`}>
          {group.title ? (
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {group.title}
            </h3>
          ) : null}
          <ul className="space-y-2.5">
            {group.items.map((item, itemIdx) => (
              <li
                key={`${group.title || "item"}-${groupIdx}-${itemIdx}`}
                className="flex items-start gap-3 text-[15px] text-slate-600 dark:text-slate-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/40" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PrepGroupsView({ groups }: { groups: RecipeGroup[] }) {
  return (
    <div className="grid gap-4">
      {groups.length === 0 ? (
        <p className="py-4 text-center text-sm italic text-slate-500">
          No prep groups. Edit recipe to add groups.
        </p>
      ) : (
        groups.map((group, groupIdx) => (
          <div
            key={`${group.title || "prep"}-${groupIdx}`}
            className="group relative rounded-2xl border border-white bg-white/60 p-4 shadow-sm transition-all hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {group.title}
              </h3>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              {group.items.map((item, itemIdx) => (
                <li key={`${group.title || "prep-item"}-${groupIdx}-${itemIdx}`} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

function InstructionsView({ instructions }: { instructions: string[] }) {
  return instructions.length === 0 ? (
    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No instructions listed yet.</p>
  ) : (
    <ol className="mt-4 space-y-3 text-sm text-slate-700 dark:text-slate-200">
      {instructions.map((step, index) => (
        <li key={`${index}-${step}`} className="flex gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function NotesView({ notes }: { notes: string[] }) {
  return notes.length === 0 ? (
    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No notes saved yet.</p>
  ) : (
    <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
      {notes.map((note) => (
        <li key={note} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          {note}
        </li>
      ))}
    </ul>
  );
}

function WatchView({
  embedUrl,
  videoUrl,
  recipeTitle,
}: {
  embedUrl: string | null;
  videoUrl: string;
  recipeTitle: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Watch this recipe</p>
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-emerald-600 dark:text-emerald-400"
        >
          Open Video
        </a>
      </div>
      {embedUrl ? (
        <div className="mt-4 aspect-[16/9] w-full">
          <iframe
            src={embedUrl}
            title={`Video for ${recipeTitle}`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center px-4 pb-4 text-sm text-slate-500 dark:text-slate-400">
          Video preview not available.
        </div>
      )}
    </div>
  );
}

function EditOverviewPanel({
  recipeTitle,
  tags,
  servings,
  prepTime,
  cookTime,
  sourceUrl,
  videoUrl,
  description,
  imageUrl,
}: Pick<
  RecipeDetailTabsProps,
  "recipeTitle" | "tags" | "servings" | "prepTime" | "cookTime" | "sourceUrl" | "videoUrl" | "description" | "imageUrl"
>) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Inline Edit
          </p>
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{recipeTitle}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Title
            <input
              name="title"
              defaultValue={recipeTitle}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Tags
            <input
              name="tags"
              defaultValue={(tags ?? []).join(", ")}
              placeholder="Weeknight, Family"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Servings
            <input
              name="servings"
              type="number"
              min={1}
              defaultValue={servings ?? undefined}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Prep (min)
              <input
                name="prepTime"
                type="number"
                min={1}
                defaultValue={prepTime ?? undefined}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cook (min)
              <input
                name="cookTime"
                type="number"
                min={1}
                defaultValue={cookTime ?? undefined}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          </div>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
            Description
            <textarea
              name="description"
              rows={2}
              defaultValue={description ?? ""}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            name="sourceUrl"
            defaultValue={sourceUrl ?? ""}
            placeholder="Source URL"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <input
            name="videoUrl"
            defaultValue={videoUrl ?? ""}
            placeholder="Video URL"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <input
            name="imageUrl"
            defaultValue={imageUrl ?? ""}
            placeholder="Image URL"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
}

export default function RecipeDetailTabs({
  ingredientGroups,
  miseGroups,
  instructions,
  notes,
  embedUrl,
  videoUrl,
  servings,
  cookCount,
  prepTime,
  cookTime,
  sourceUrl,
  authorLabel,
  tags = [],
  description,
  imageUrl,
  isEditing,
  recipeTitle,
}: RecipeDetailTabsProps) {
  const [leftTab, setLeftTab] = useState<LeftTab>("ingredients");
  const [rightTab, setRightTab] = useState<RightTab>("instructions");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedLeft = window.localStorage.getItem(LEFT_TAB_KEY);
      if (isLeftTab(storedLeft)) {
        setLeftTab(storedLeft);
      }

      const storedRight = window.localStorage.getItem(RIGHT_TAB_KEY);
      if (isRightTab(storedRight)) {
        setRightTab(storedRight);
      }
    } catch {
      // Ignore storage failures and fall back to defaults.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(LEFT_TAB_KEY, leftTab);
    } catch {
      // Ignore storage failures.
    }
  }, [isHydrated, leftTab]);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      window.localStorage.setItem(RIGHT_TAB_KEY, rightTab);
    } catch {
      // Ignore storage failures.
    }
  }, [isHydrated, rightTab]);

  const visibleRightTab = getVisibleRightTab(rightTab, videoUrl);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-1">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="pt-6">
            {isEditing ? (
              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Ingredients
                  </p>
                  <IngredientGroupsEditor initialGroups={ingredientGroups} />
                </div>
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-amber-400 dark:text-amber-500">
                    Prep Groups
                  </p>
                  <IngredientGroupsEditor initialGroups={miseGroups} prefix="miseGroup" />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-5 border-b border-slate-200 dark:border-slate-800">
                  <TabButton active={leftTab === "ingredients"} onClick={() => setLeftTab("ingredients")}>
                    Ingredients
                  </TabButton>
                  <TabButton active={leftTab === "prepGroups"} onClick={() => setLeftTab("prepGroups")}>
                    Prep Groups
                  </TabButton>
                </div>
                <div className="pt-6">
                  <div hidden={leftTab !== "ingredients"} aria-hidden={leftTab !== "ingredients"}>
                    <LeftView groups={ingredientGroups} />
                  </div>
                  <div hidden={leftTab !== "prepGroups"} aria-hidden={leftTab !== "prepGroups"}>
                    <PrepGroupsView groups={miseGroups} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-6 lg:col-span-2">
        {isEditing ? (
          <EditOverviewPanel
            recipeTitle={recipeTitle}
            tags={tags}
            servings={servings}
            prepTime={prepTime}
            cookTime={cookTime}
            sourceUrl={sourceUrl}
            videoUrl={videoUrl}
            description={description}
            imageUrl={imageUrl}
          />
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-3">
              {servings ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {servings} servings
                </span>
              ) : null}
              {cookCount && cookCount > 0 ? (
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400">
                  🍳 Cooked x{cookCount}
                </span>
              ) : null}
              {formatMinutes(prepTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Prep {formatMinutes(prepTime)}
                </span>
              ) : null}
              {formatMinutes(cookTime) ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Cook {formatMinutes(cookTime)}
                </span>
              ) : null}
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {authorLabel ? `By ${authorLabel}` : "Source"}
                </a>
              ) : null}
            </div>
          ) : null}

          {!isEditing && tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="pt-6">
            {isEditing ? (
              <div className="space-y-8">
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Instructions
                  </p>
                  <LineListEditor
                    name="instructions"
                    initialItems={instructions}
                    ordered
                    placeholder="Describe this step..."
                    addLabel="+ Add step"
                  />
                </div>
                <div>
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Notes
                  </p>
                  <LineListEditor
                    name="notes"
                    initialItems={notes}
                    ordered={false}
                    placeholder="Add a note..."
                    addLabel="+ Add note"
                  />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-5 border-b border-slate-200 dark:border-slate-800">
                  <TabButton
                    active={visibleRightTab === "instructions"}
                    onClick={() => setRightTab("instructions")}
                  >
                    Instructions
                  </TabButton>
                  <TabButton active={visibleRightTab === "notes"} onClick={() => setRightTab("notes")}>
                    Notes
                  </TabButton>
                  {videoUrl ? (
                    <TabButton active={visibleRightTab === "watch"} onClick={() => setRightTab("watch")}>
                      Watch
                    </TabButton>
                  ) : null}
                </div>
                <div className="pt-6">
                  <div hidden={visibleRightTab !== "instructions"} aria-hidden={visibleRightTab !== "instructions"}>
                    <InstructionsView instructions={instructions} />
                  </div>
                  <div hidden={visibleRightTab !== "notes"} aria-hidden={visibleRightTab !== "notes"}>
                    <NotesView notes={notes} />
                  </div>
                  {videoUrl ? (
                    <div hidden={visibleRightTab !== "watch"} aria-hidden={visibleRightTab !== "watch"}>
                      <WatchView embedUrl={embedUrl} videoUrl={videoUrl} recipeTitle={recipeTitle} />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
