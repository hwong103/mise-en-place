"use client";

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
import { upsertMealPlan } from "@/app/(dashboard)/planner/actions";

type PlannerRecipe = {
  id: string;
  title: string;
};

type PlannerDay = {
  dateKey: string;
  label: string;
};

type PlannerSlot = {
  dateKey: string;
  recipeId: string | null;
  recipeTitle: string | null;
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
        "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300" +
        (isDragging ? " opacity-70" : "")
      }
      type="button"
    >
      {recipe.title}
    </button>
  );
}

function DayCard({
  slotKey,
  label,
  recipeTitle,
  onClear,
}: {
  slotKey: string;
  label: string;
  recipeTitle: string | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: slotKey });

  return (
    <div
      ref={setNodeRef}
      className={
        "flex min-h-[140px] flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all" +
        (isOver ? " border-indigo-400 bg-indigo-50/40" : "")
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        {recipeTitle ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        {recipeTitle ? <span className="font-semibold text-slate-700">{recipeTitle}</span> : "Drop recipe here"}
      </div>
    </div>
  );
}

export default function PlannerBoard({ days, recipes, slots }: PlannerBoardProps) {
  const [slotState, setSlotState] = useState(() => {
    const map = new Map<string, PlannerSlot>();
    slots.forEach((slot) => map.set(buildSlotKey(slot.dateKey), slot));
    return map;
  });
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

  const handleAssign = (dateKey: string, recipeId: string | null) => {
    const slotKey = buildSlotKey(dateKey);
    const recipeTitle = recipeId ? recipeLookup.get(recipeId)?.title ?? "" : null;

    setSlotState((prev) => {
      const next = new Map(prev);
      next.set(slotKey, {
        dateKey,
        recipeId,
        recipeTitle,
      });
      return next;
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", dateKey);
      if (recipeId) {
        formData.set("recipeId", recipeId);
      }
      await upsertMealPlan(formData);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Recipes</h2>
          <p className="text-xs text-slate-500">Search and drag onto a day.</p>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search recipes"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none"
        />

        <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
          {filteredRecipes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
              No matching recipes.
            </div>
          ) : (
            filteredRecipes.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)
          )}
        </div>
      </aside>

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {days.map((day) => {
            const slotKey = buildSlotKey(day.dateKey);
            const slot = slotState.get(slotKey);
            return (
              <DayCard
                key={slotKey}
                slotKey={slotKey}
                label={day.label}
                recipeTitle={slot?.recipeTitle ?? null}
                onClear={() => handleAssign(day.dateKey, null)}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeRecipeId ? (
            <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg">
              {recipeLookup.get(activeRecipeId)?.title ?? "Recipe"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isPending ? <div className="text-xs text-slate-400">Saving plan...</div> : null}
    </div>
  );
}
