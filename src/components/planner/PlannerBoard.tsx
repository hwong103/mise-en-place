"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, useEffect } from "react";
import {
  clearMealPlanDay,
  removeMealPlanEntry,
  upsertMealPlan,
  markMealPlanCooked,
  unmarkMealPlanCooked
} from "@/app/(dashboard)/planner/actions";
import { toDateKey } from "@/lib/date";
import FadeContent from "@/components/ui/FadeContent";
import AnimatedList from "@/components/ui/AnimatedList";
import ClickSpark from "@/components/ui/ClickSpark";
import { useToast } from "@/components/ui/Toast";

type MealType = "DINNER" | "LUNCH" | "BREAKFAST" | "SNACK";

const MEAL_TYPE_ORDER: MealType[] = ["DINNER", "LUNCH", "BREAKFAST", "SNACK"];
const MEAL_TYPE_RANK = new Map(MEAL_TYPE_ORDER.map((mealType, index) => [mealType, index]));

type PlannerRecipe = {
  id: string;
  title: string;
  imageUrl?: string | null;
  cookCount?: number;
};

type PlannerDay = {
  dateKey: string;
  label: string;
};

type PlannerSlot = {
  id: string;
  dateKey: string;
  recipeId: string | null;
  recipeTitle: string | null;
  recipeImageUrl?: string | null;
  mealType: MealType;
  cooked: boolean;
  cookedAt?: string | null;
};

type PlannerBoardProps = {
  days: PlannerDay[];
  pastDays: PlannerDay[];
  recipes: PlannerRecipe[];
  slots: PlannerSlot[];
};

const buildSlotKey = (dateKey: string) => `slot:${dateKey}`;

function RecipeTile({
  recipe,
  isSelected,
  onSelect,
}: {
  recipe: PlannerRecipe;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(recipe.id)}
      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold shadow-sm transition-all
        ${isSelected
          ? "border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/30 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400"
        }`}
    >
      <span className="flex items-center gap-3">
        <span className={`relative h-8 w-8 overflow-hidden rounded-lg border bg-slate-100 transition-all
          ${isSelected ? "border-emerald-300 dark:border-emerald-600" : "border-slate-200 dark:border-slate-700 dark:bg-slate-800"}`}
        >
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{recipe.title}</span>
          {recipe.cookCount && recipe.cookCount > 0 ? (
            <span className="text-[10px] font-medium text-slate-400">🍳 Cooked x{recipe.cookCount}</span>
          ) : null}
        </div>
        {isSelected && (
          <span className="shrink-0 text-emerald-500 text-base">✓</span>
        )}
      </span>
    </button>
  );
}

function PastDayCard({
  label,
  recipeSlots,
  onMarkCooked,
  onUnmarkCooked,
  onClear,
}: {
  label: string;
  recipeSlots: PlannerSlot[];
  onMarkCooked: (planId: string) => void;
  onUnmarkCooked: (planId: string) => void;
  onClear: (planId: string) => void;
}) {
  return (
    <div className="flex min-h-[120px] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>

      {recipeSlots.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No plans for this day</p>
      ) : (
        <div className="space-y-3">
          {recipeSlots.map((slot) => (
            <div key={slot.id} className="space-y-1.5">
              {slot.cooked ? (
                <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800/50 dark:bg-green-950/30">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-green-200">
                    {slot.recipeImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.recipeImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <Link href={`/recipes/${slot.recipeId}`} className="flex-1 truncate text-sm font-semibold text-green-800 dark:text-green-300 transition-colors hover:underline underline-offset-4 decoration-green-400/50">
                    {slot.recipeTitle}
                  </Link>
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/60 dark:text-green-300">
                    ✓ Cooked
                  </span>
                  <button onClick={() => onUnmarkCooked(slot.id)} className="text-slate-400 hover:text-rose-500 text-base leading-none font-medium px-1" title="Undo">
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 opacity-70 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 grayscale">
                      {slot.recipeImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slot.recipeImageUrl} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <Link href={`/recipes/${slot.recipeId}`} className="flex-1 truncate text-sm font-semibold text-slate-500 line-through decoration-slate-400 decoration-1 underline-offset-4 transition-colors">
                      {slot.recipeTitle}
                    </Link>
                  </div>
                  <div className="flex gap-2 pl-12">
                    <ClickSpark sparkColor="#10b981" sparkCount={8}>
                      <button onClick={() => onMarkCooked(slot.id)}
                        className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-100 transition-colors dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60">
                        ✓ Mark cooked
                      </button>
                    </ClickSpark>
                    <button onClick={() => onClear(slot.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-400 hover:border-rose-200 hover:text-rose-500 transition-colors dark:border-slate-700 dark:bg-slate-950 dark:hover:border-rose-900 dark:hover:text-rose-400">
                      Clear
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({
  label,
  recipeSlots,
  isToday,
  isAssignable,
  onAssign,
  onClearDay,
  onRemoveEntry,
  onMarkCooked,
  onUnmarkCooked,
}: {
  label: string;
  recipeSlots: PlannerSlot[];
  isToday?: boolean;
  isAssignable: boolean;
  onAssign: () => void;
  onClearDay: () => void;
  onRemoveEntry: (planId: string) => void;
  onMarkCooked: (planId: string) => void;
  onUnmarkCooked: (planId: string) => void;
}) {
  return (
    <div
      onClick={isAssignable ? onAssign : undefined}
      className={`flex min-h-[190px] flex-col rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-slate-900
        ${isAssignable
          ? "cursor-pointer border-emerald-300 bg-emerald-50/30 ring-2 ring-emerald-300/30 hover:border-emerald-400 hover:bg-emerald-50/60 dark:border-emerald-600/60 dark:bg-emerald-950/20 dark:ring-emerald-600/20"
          : "border-slate-200 dark:border-slate-800"
        }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        {recipeSlots.length > 0 ? (
          <button
            type="button"
            onClick={onClearDay}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            Clear day
          </button>
        ) : null}
      </div>

      {recipeSlots.length === 0 ? (
        <div className={`flex flex-1 items-center justify-center rounded-2xl border border-dashed px-3 py-2 text-sm transition-colors
          ${isAssignable
            ? "border-emerald-300 bg-emerald-50/50 text-emerald-600 dark:border-emerald-600/50 dark:bg-emerald-950/30 dark:text-emerald-400"
            : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400"
          }`}
        >
          {isAssignable ? "Tap to add here" : "Select a recipe"}
        </div>
      ) : (
        <div className="space-y-4">
          {recipeSlots.map((slot) => (
            <div key={slot.id} className="space-y-2">
              <div
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${slot.cooked
                  ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/20"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-950/30"
                  }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border transition-all ${slot.cooked ? "border-green-200" : "border-slate-200 dark:border-slate-700"
                    }`}>
                    {slot.recipeImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slot.recipeImageUrl} alt="" className={`h-full w-full object-cover transition-all ${slot.cooked ? "grayscale-0" : ""}`} />
                    ) : null}
                  </div>
                  <Link
                    href={`/recipes/${slot.recipeId}`}
                    className={`truncate text-sm font-semibold transition-colors hover:underline underline-offset-4 ${slot.cooked
                      ? "text-green-800 dark:text-green-300 decoration-green-300"
                      : "text-slate-700 dark:text-slate-200 decoration-slate-400"
                      }`}
                  >
                    {slot.recipeTitle}
                  </Link>
                </div>

                {!slot.cooked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveEntry(slot.id);
                    }}
                    className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-rose-300"
                    aria-label={`Remove ${slot.recipeTitle ?? "recipe"}`}
                    title="Remove recipe"
                  >
                    x
                  </button>
                )}
              </div>

              {isToday && (
                <div className="flex gap-2 px-1">
                  {slot.cooked ? (
                    <>
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700 dark:bg-green-900/60 dark:text-green-300">
                        ✓ Cooked
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnmarkCooked(slot.id);
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-tight transition-colors"
                      >
                        Undo
                      </button>
                    </>
                  ) : (
                    <ClickSpark sparkColor="#10b981" sparkCount={8}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkCooked(slot.id);
                        }}
                        className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60"
                      >
                        ✓ Mark as cooked
                      </button>
                    </ClickSpark>
                  )}
                </div>
              )}
            </div>
          ))}
          {isAssignable && (
            <div className="mt-2 flex items-center justify-center rounded-xl border border-dashed border-emerald-300 py-1.5 text-xs font-semibold text-emerald-600 dark:border-emerald-600/50 dark:text-emerald-400">
              ＋ Add here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const getInitialSlotState = (days: PlannerDay[], slots: PlannerSlot[]) => {
  const map = new Map<string, PlannerSlot[]>();

  days.forEach((day) => {
    const slotKey = buildSlotKey(day.dateKey);
    const entries = slots
      .filter((slot) => slot.dateKey === day.dateKey)
      .sort((a, b) => (MEAL_TYPE_RANK.get(a.mealType) ?? 99) - (MEAL_TYPE_RANK.get(b.mealType) ?? 99));
    map.set(slotKey, entries);
  });

  return map;
};

const getNextMealType = (entries: PlannerSlot[]) => {
  const used = new Set(entries.map((entry) => entry.mealType));
  return MEAL_TYPE_ORDER.find((mealType) => !used.has(mealType));
};

export default function PlannerBoard({ days, pastDays, recipes, slots }: PlannerBoardProps) {
  const allDaysForState = useMemo(() => [...pastDays, ...days], [pastDays, days]);
  const [slotState, setSlotState] = useState(() => getInitialSlotState(allDaysForState, slots));
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"this-week" | "last-week">("this-week");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  const lastWeekCookedCount = useMemo(() => {
    return pastDays.reduce((count, day) => {
      const daySlots = slotState.get(buildSlotKey(day.dateKey)) ?? [];
      return count + daySlots.filter((s) => s.cooked).length;
    }, 0);
  }, [pastDays, slotState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRecipeId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isDayFull = (dateKey: string) => {
    const slots = slotState.get(buildSlotKey(dateKey)) ?? [];
    return getNextMealType(slots) === undefined;
  };

  const recipeLookup = useMemo(() => {
    const map = new Map<string, PlannerRecipe>();
    recipes.forEach((recipe) => map.set(recipe.id, recipe));
    return map;
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return recipes;
    }

    return recipes.filter((recipe) => recipe.title.toLowerCase().includes(needle));
  }, [recipes, query]);

  const handleAssign = (dateKey: string, recipeId: string) => {
    const slotKey = buildSlotKey(dateKey);
    const recipe = recipeLookup.get(recipeId);
    if (!recipe) {
      return;
    }

    const currentEntries = slotState.get(slotKey) ?? [];
    if (currentEntries.some((entry) => entry.recipeId === recipeId)) {
      return;
    }

    const nextMealType = getNextMealType(currentEntries);
    if (!nextMealType) {
      return;
    }

    const tempId = `temp:${dateKey}:${recipeId}:${Date.UTC(2025, 0, 1)}`; // stable-ish for optimistic update
    const optimisticEntry: PlannerSlot = {
      id: tempId,
      dateKey,
      recipeId,
      recipeTitle: recipe.title,
      recipeImageUrl: recipe.imageUrl ?? null,
      mealType: nextMealType,
      cooked: false,
    };

    setSlotState((prev) => {
      const next = new Map(prev);
      const existing = next.get(slotKey) ?? [];
      next.set(
        slotKey,
        [...existing, optimisticEntry].sort(
          (a, b) => (MEAL_TYPE_RANK.get(a.mealType) ?? 99) - (MEAL_TYPE_RANK.get(b.mealType) ?? 99)
        )
      );
      return next;
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", dateKey);
      formData.set("recipeId", recipeId);
      const result = await upsertMealPlan(formData);
      showToast("Recipe planned 📅", "success");

      if (result?.status === "created") {
        setSlotState((prev) => {
          const next = new Map(prev);
          const existing = next.get(slotKey) ?? [];
          next.set(
            slotKey,
            existing
              .map((entry) =>
                entry.id === tempId
                  ? { ...entry, id: result.id, mealType: result.mealType as MealType }
                  : entry
              )
              .sort((a, b) => (MEAL_TYPE_RANK.get(a.mealType) ?? 99) - (MEAL_TYPE_RANK.get(b.mealType) ?? 99))
          );
          return next;
        });
        return;
      }

      setSlotState((prev) => {
        const next = new Map(prev);
        const existing = next.get(slotKey) ?? [];
        next.set(
          slotKey,
          existing.filter((entry) => entry.id !== tempId)
        );
        return next;
      });
    });
  };

  const handleRemove = (dateKey: string, planId: string) => {
    const slotKey = buildSlotKey(dateKey);
    setSlotState((prev) => {
      const next = new Map(prev);
      const existing = next.get(slotKey) ?? [];
      next.set(
        slotKey,
        existing.filter((entry) => entry.id !== planId)
      );
      return next;
    });

    if (planId.startsWith("temp:")) {
      return;
    }

    startTransition(async () => {
      await removeMealPlanEntry({ planId });
    });
  };

  const handleClearDay = (dateKey: string) => {
    const slotKey = buildSlotKey(dateKey);
    setSlotState((prev) => {
      const next = new Map(prev);
      next.set(slotKey, []);
      return next;
    });

    startTransition(async () => {
      await clearMealPlanDay({ date: dateKey });
    });
    showToast("Day cleared", "info");
  };

  const handleMarkCooked = (dateKey: string, planId: string) => {
    const slotKey = buildSlotKey(dateKey);
    setSlotState((prev) => {
      const next = new Map(prev);
      const existing = next.get(slotKey) ?? [];
      next.set(slotKey, existing.map(s =>
        s.id === planId ? { ...s, cooked: true, cookedAt: new Date().toISOString() } : s
      ));
      return next;
    });
    startTransition(async () => {
      await markMealPlanCooked({ planId });
    });
    showToast("Marked as cooked 🍳", "success");
  };

  const handleUnmarkCooked = (dateKey: string, planId: string) => {
    const slotKey = buildSlotKey(dateKey);
    setSlotState((prev) => {
      const next = new Map(prev);
      const existing = next.get(slotKey) ?? [];
      next.set(slotKey, existing.map(s =>
        s.id === planId ? { ...s, cooked: false, cookedAt: null } : s
      ));
      return next;
    });
    startTransition(async () => {
      await unmarkMealPlanCooked({ planId });
    });
  };

  const todayKey = toDateKey(new Date());

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="sticky top-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recipes</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Select a recipe, then tap a day to plan it.</p>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes"
            className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <AnimatedList
            stagger={0.05}
            className="max-h-[40vh] space-y-2 overflow-auto pr-1 lg:max-h-[70vh]"
          >
            {filteredRecipes.length === 0 ? (
              <div key="empty" className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                No matching recipes.
              </div>
            ) : (
              filteredRecipes.map((recipe) => (
                <RecipeTile
                  key={recipe.id}
                  recipe={recipe}
                  isSelected={selectedRecipeId === recipe.id}
                  onSelect={(id) => {
                    setSelectedRecipeId((prev) => {
                      const next = prev === id ? null : id;
                      if (next) setActiveTab("this-week");
                      return next;
                    });
                  }}
                />
              ))
            )}
          </AnimatedList>
        </div>
      </aside>

      <div className="space-y-5">
        {/* Tab bar */}
        <div className="flex items-center gap-1 self-start rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/60">
          {(["this-week", "last-week"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                if (tab === "last-week") setSelectedRecipeId(null);
              }}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all
                  ${activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
            >
              {tab === "this-week" ? (
                "This Week"
              ) : (
                <span className="flex items-center gap-1.5">
                  Last Week
                  {lastWeekCookedCount > 0 && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      {lastWeekCookedCount}✓
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selection banner — only shown on this-week tab */}
        {activeTab === "this-week" && selectedRecipeId && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span>
              <span className="font-bold">
                {recipeLookup.get(selectedRecipeId)?.title}
              </span>
              {" "}— tap a day to assign
            </span>
            <button
              type="button"
              onClick={() => setSelectedRecipeId(null)}
              className="shrink-0 text-emerald-500 hover:text-emerald-700 dark:text-emerald-400"
              aria-label="Cancel selection"
            >
              ✕
            </button>
          </div>
        )}

        {/* This Week grid */}
        {activeTab === "this-week" && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {days.map((day, index) => {
              const slotKey = buildSlotKey(day.dateKey);
              const daySlots = slotState.get(slotKey) ?? [];
              const assignable = selectedRecipeId !== null && !isDayFull(day.dateKey);

              return (
                <FadeContent key={slotKey} delay={index * 0.04}>
                  <DayCard
                    label={day.dateKey === todayKey ? `Today, ${day.label.split(', ')[1]}` : day.label}
                    recipeSlots={daySlots}
                    isToday={day.dateKey === todayKey}
                    isAssignable={assignable}
                    onAssign={() => {
                      if (!selectedRecipeId) return;
                      handleAssign(day.dateKey, selectedRecipeId);
                      setSelectedRecipeId(null);
                    }}
                    onClearDay={() => handleClearDay(day.dateKey)}
                    onRemoveEntry={(planId) => handleRemove(day.dateKey, planId)}
                    onMarkCooked={(planId) => handleMarkCooked(day.dateKey, planId)}
                    onUnmarkCooked={(planId) => handleUnmarkCooked(day.dateKey, planId)}
                  />
                </FadeContent>
              );
            })}
          </div>
        )}

        {/* Last Week grid */}
        {activeTab === "last-week" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pastDays.map((day) => {
              const slotKey = buildSlotKey(day.dateKey);
              const daySlots = slotState.get(slotKey) ?? [];
              return (
                <PastDayCard
                  key={slotKey}
                  label={day.label}
                  recipeSlots={daySlots}
                  onMarkCooked={(planId) => handleMarkCooked(day.dateKey, planId)}
                  onUnmarkCooked={(planId) => handleUnmarkCooked(day.dateKey, planId)}
                  onClear={(planId) => handleRemove(day.dateKey, planId)}
                />
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}
