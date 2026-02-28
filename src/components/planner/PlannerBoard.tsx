"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  clearMealPlanDay,
  removeMealPlanEntry,
  upsertMealPlan,
  markMealPlanCooked,
  unmarkMealPlanCooked
} from "@/app/(dashboard)/planner/actions";
import { fromDateKey, normalizeToUtcDate, toDateKey } from "@/lib/date";
import { Play } from "lucide-react";

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

function RecipeTile({ recipe }: { recipe: PlannerRecipe }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: recipe.id,
    data: { recipeId: recipe.id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-400" +
        (isDragging ? " opacity-70" : "")
      }
      type="button"
    >
      <span className="flex items-center gap-3">
        <span className="relative h-8 w-8 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="truncate">{recipe.title}</span>
          {recipe.cookCount && recipe.cookCount > 0 ? (
            <span className="text-[10px] text-slate-400 font-medium">🍳 cooked {recipe.cookCount}x</span>
          ) : null}
        </div>
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
                    <button onClick={() => onMarkCooked(slot.id)}
                      className="rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-100 transition-colors dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60">
                      ✓ Mark cooked
                    </button>
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
  slotKey,
  label,
  recipeSlots,
  isToday,
  onClearDay,
  onRemoveEntry,
  onMarkCooked,
  onUnmarkCooked,
}: {
  slotKey: string;
  label: string;
  recipeSlots: PlannerSlot[];
  isToday?: boolean;
  onClearDay: () => void;
  onRemoveEntry: (planId: string) => void;
  onMarkCooked: (planId: string) => void;
  onUnmarkCooked: (planId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotKey });

  return (
    <div
      ref={setNodeRef}
      className={
        "flex min-h-[190px] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900" +
        (isOver ? " border-emerald-400 bg-emerald-50/40 dark:border-emerald-500/60 dark:bg-emerald-950/40" : "")
      }
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
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
          Drop recipe here
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
                    onClick={() => onRemoveEntry(slot.id)}
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
                        onClick={() => onUnmarkCooked(slot.id)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-tight transition-colors"
                      >
                        Undo
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onMarkCooked(slot.id)}
                      className="rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700 hover:bg-green-100 transition-colors dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-900/60"
                    >
                      ✓ Mark as cooked
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
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
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

    const tempId = `temp:${dateKey}:${recipeId}:${Date.now()}`;
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveRecipeId(String(event.active.id))}
        onDragEnd={(event) => {
          setActiveRecipeId(null);
          const recipeId = String(event.active.id);
          const overId = event.over?.id;
          if (!overId || typeof overId !== "string") return;
          if (!overId.startsWith("slot:")) return;

          const [, dateKey] = overId.split(":");
          if (!dateKey) return;

          const targetDate = fromDateKey(dateKey);
          const today = normalizeToUtcDate(new Date());
          if (targetDate < today) return; // block past drops

          handleAssign(dateKey, recipeId);
        }}
      >
        <aside className="space-y-4">
          <div className="sticky top-6">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recipes</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Search and drag onto a day.</p>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search recipes"
              className="mb-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />

            <div className="max-h-[40vh] space-y-2 overflow-auto pr-1 lg:max-h-[70vh]">
              {filteredRecipes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No matching recipes.
                </div>
              ) : (
                filteredRecipes.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)
              )}
            </div>
          </div>
        </aside>

        <div className="space-y-12">
          {/* Past days */}
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400/80">
              Past 7 days
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
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
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Upcoming Plans
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => {
              const slotKey = buildSlotKey(day.dateKey);
              const daySlots = slotState.get(slotKey) ?? [];
              return (
                <DayCard
                  key={slotKey}
                  slotKey={slotKey}
                  label={day.dateKey === todayKey ? `Today, ${day.label.split(', ')[1]}` : day.label}
                  recipeSlots={daySlots}
                  isToday={day.dateKey === todayKey}
                  onClearDay={() => handleClearDay(day.dateKey)}
                  onRemoveEntry={(planId) => handleRemove(day.dateKey, planId)}
                  onMarkCooked={(planId) => handleMarkCooked(day.dateKey, planId)}
                  onUnmarkCooked={(planId) => handleUnmarkCooked(day.dateKey, planId)}
                />
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeRecipeId ? (
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-xl dark:border-emerald-500/40 dark:bg-slate-900 dark:text-slate-200">
              {recipeLookup.get(activeRecipeId)?.title ?? "Recipe"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isPending && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-2xl dark:bg-white dark:text-slate-900">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Saving...
        </div>
      )}
    </div>
  );
}
