"use client";

import { useState } from "react";
import { addToMealPlan } from "@/app/(dashboard)/recipes/actions";

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

  const today = new Date().toISOString().split("T")[0];
  const dateValue = defaultDate ?? today;

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
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Add to Planner</h3>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Schedule <span className="font-semibold text-emerald-600 dark:text-emerald-400">{recipeTitle}</span> for a day.
        </p>

        <form action={clientAction} className="space-y-4">
          <input type="hidden" name="recipeId" value={recipeId} />

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={dateValue}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
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
