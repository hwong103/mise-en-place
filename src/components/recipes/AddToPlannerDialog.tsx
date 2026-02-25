"use client";

import { useState } from "react";
import { addToMealPlan } from "@/app/(dashboard)/recipes/actions";
import { toDateKey } from "@/lib/date";

type AddToPlannerDialogProps = {
  recipeId: string;
  recipeTitle: string;
  defaultDate?: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

export default function AddToPlannerDialog({
  recipeId,
  recipeTitle,
  defaultDate,
  triggerLabel = "Add to Planner",
  triggerClassName,
}: AddToPlannerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate ?? today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i);
    return {
      key: toDateKey(day),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : day.toLocaleDateString("en-AU", { weekday: "short" }),
      sublabel: day.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    };
  });

  async function clientAction(formData: FormData) {
    setIsPending(true);
    await addToMealPlan(formData);
    setIsPending(false);
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
        }
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add to Planner</h3>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Schedule <span className="font-semibold text-emerald-600 dark:text-emerald-400">{recipeTitle}</span> for a day.
        </p>

        <form action={clientAction} className="space-y-4">
          <input type="hidden" name="recipeId" value={recipeId} />
          <input type="hidden" name="date" value={selectedDate} />
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {days.map((day) => {
              const isSelected = selectedDate === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                  className={`flex flex-col items-center rounded-2xl border px-2 py-3 text-center transition-colors ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-500/50"
                  }`}
                >
                  <span className="text-xs font-semibold">{day.label}</span>
                  <span
                    className={`mt-0.5 text-[11px] ${
                      isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {day.sublabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Add to Planner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
