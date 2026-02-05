"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { upsertMealPlan } from "@/app/(dashboard)/planner/actions";

const MEAL_TYPES = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snack" },
] as const;

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
  mealType: (typeof MEAL_TYPES)[number]["value"];
  recipeId: string | null;
  recipeTitle: string | null;
};

type PlannerBoardProps = {
  days: PlannerDay[];
  recipes: PlannerRecipe[];
  slots: PlannerSlot[];
};

const buildSlotKey = (dateKey: string, mealType: string) => `slot:${dateKey}:${mealType}`;

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
        "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-indigo-300" +
        (isDragging ? " opacity-70" : "")
      }
      type="button"
    >
      {recipe.title}
    </button>
  );
}

function SlotCard({
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
        "rounded-2xl border border-slate-100 bg-slate-50 p-3 transition-all" +
        (isOver ? " border-indigo-300 bg-indigo-50/60" : "")
      }
    >
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>{label}</span>
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
      <div className="mt-2 text-xs text-slate-500">
        {recipeTitle ? (
          <span className="font-semibold text-slate-700">{recipeTitle}</span>
        ) : (
          "Drop a recipe here"
        )}
      </div>
    </div>
  );
}

export default function PlannerBoard({ days, recipes, slots }: PlannerBoardProps) {
  const [slotState, setSlotState] = useState(() => {
    const map = new Map<string, PlannerSlot>();
    slots.forEach((slot) => map.set(buildSlotKey(slot.dateKey, slot.mealType), slot));
    return map;
  });
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const recipeLookup = useMemo(() => {
    const map = new Map<string, PlannerRecipe>();
    recipes.forEach((recipe) => map.set(recipe.id, recipe));
    return map;
  }, [recipes]);

  const handleAssign = (dateKey: string, mealType: string, recipeId: string | null) => {
    const slotKey = buildSlotKey(dateKey, mealType);
    const recipeTitle = recipeId ? recipeLookup.get(recipeId)?.title ?? "" : null;

    setSlotState((prev) => {
      const next = new Map(prev);
      next.set(slotKey, {
        dateKey,
        mealType: mealType as PlannerSlot["mealType"],
        recipeId,
        recipeTitle,
      });
      return next;
    });

    startTransition(async () => {
      const formData = new FormData();
      formData.set("date", dateKey);
      formData.set("mealType", mealType);
      if (recipeId) {
        formData.set("recipeId", recipeId);
      }
      await upsertMealPlan(formData);
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Recipes</h2>
          <p className="text-xs text-slate-500">Drag to schedule meals.</p>
        </div>
        <div className="space-y-2">
          {recipes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">
              Add recipes first.
            </div>
          ) : (
            recipes.map((recipe) => <RecipeTile key={recipe.id} recipe={recipe} />)
          )}
        </div>
      </aside>

      <DndContext
        sensors={sensors}
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
          const [, dateKey, mealType] = overId.split(":");
          if (!dateKey || !mealType) {
            return;
          }
          handleAssign(dateKey, mealType, recipeId);
        }}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          {days.map((day) => (
            <div key={day.dateKey} className="flex flex-col space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-widest text-slate-400">{day.label}</p>
              </div>
              <div className="space-y-3">
                {MEAL_TYPES.map((mealType) => {
                  const slotKey = buildSlotKey(day.dateKey, mealType.value);
                  const slot = slotState.get(slotKey);
                  return (
                    <SlotCard
                      key={slotKey}
                      slotKey={slotKey}
                      label={mealType.label}
                      recipeTitle={slot?.recipeTitle ?? null}
                      onClear={() => handleAssign(day.dateKey, mealType.value, null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DragOverlay>
          {activeRecipeId ? (
            <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg">
              {recipeLookup.get(activeRecipeId)?.title ?? "Recipe"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isPending ? (
        <div className="text-xs text-slate-400">Saving plan...</div>
      ) : null}
    </div>
  );
}
