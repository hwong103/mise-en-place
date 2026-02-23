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
import { clearMealPlanDay, removeMealPlanEntry, upsertMealPlan } from "@/app/(dashboard)/planner/actions";

type MealType = "DINNER" | "LUNCH" | "BREAKFAST" | "SNACK";

const MEAL_TYPE_ORDER: MealType[] = ["DINNER", "LUNCH", "BREAKFAST", "SNACK"];
const MEAL_TYPE_RANK = new Map(MEAL_TYPE_ORDER.map((mealType, index) => [mealType, index]));

type PlannerRecipe = {
  id: string;
  title: string;
  imageUrl?: string | null;
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
};

type PlannerBoardProps = {
  days: PlannerDay[];
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
        <span>{recipe.title}</span>
      </span>
    </button>
  );
}

function DayCard({
  slotKey,
  label,
  recipeSlots,
  onClearDay,
  onRemoveEntry,
}: {
  slotKey: string;
  label: string;
  recipeSlots: PlannerSlot[];
  onClearDay: () => void;
  onRemoveEntry: (planId: string) => void;
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
        <div className="flex flex-1 items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400">
          Drop recipe here
        </div>
      ) : (
        <div className="space-y-2">
          {recipeSlots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                  {slot.recipeImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={slot.recipeImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <Link
                  href={`/recipes/${slot.recipeId}`}
                  className="truncate text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-emerald-700 dark:text-slate-200 dark:decoration-slate-600 dark:hover:text-emerald-300"
                >
                  {slot.recipeTitle}
                </Link>
              </div>

              <button
                type="button"
                onClick={() => onRemoveEntry(slot.id)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-rose-300"
                aria-label={`Remove ${slot.recipeTitle ?? "recipe"}`}
                title="Remove recipe"
              >
                x
              </button>
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

export default function PlannerBoard({ days, recipes, slots }: PlannerBoardProps) {
  const [slotState, setSlotState] = useState(() => getInitialSlotState(days, slots));
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

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveRecipeId(String(event.active.id))}
        onDragEnd={(event) => {
          setActiveRecipeId(null);
          const recipeId = String(event.active.id);
          const overId = event.over?.id;
          if (!overId || typeof overId !== "string") {
            return;
          }
          if (!overId.startsWith("slot:")) {
            return;
          }
          const [, dateKey] = overId.split(":");
          if (!dateKey) {
            return;
          }
          handleAssign(dateKey, recipeId);
        }}
      >
        <aside className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recipes</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Search and drag onto a day.</p>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search recipes"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {filteredRecipes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                No matching recipes.
              </div>
            ) : (
              filteredRecipes.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)
            )}
          </div>
        </aside>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {days.map((day) => {
            const slotKey = buildSlotKey(day.dateKey);
            const daySlots = slotState.get(slotKey) ?? [];
            return (
              <DayCard
                key={slotKey}
                slotKey={slotKey}
                label={day.label}
                recipeSlots={daySlots}
                onClearDay={() => handleClearDay(day.dateKey)}
                onRemoveEntry={(planId) => handleRemove(day.dateKey, planId)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeRecipeId ? (
            <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg dark:border-emerald-500/40 dark:bg-slate-900 dark:text-slate-200">
              {recipeLookup.get(activeRecipeId)?.title ?? "Recipe"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isPending ? <div className="text-xs text-slate-400 dark:text-slate-500">Saving plan...</div> : null}
    </div>
  );
}
