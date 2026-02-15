"use client";

import { useState } from "react";
import { addToMealPlan } from "@/app/(dashboard)/recipes/actions";

type AddToPlannerDialogProps = {
  recipeId: string;
  recipeTitle: string;
  defaultDate?: string;
};

export default function AddToPlannerDialog({ recipeId, recipeTitle, defaultDate }: AddToPlannerDialogProps) {
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
        className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
      >
        Plan this Day
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Add to Planner</h3>
        <p className="mb-6 text-sm text-slate-500">
          Schedule <span className="font-semibold text-indigo-600">{recipeTitle}</span> for a day.
        </p>

        <form action={clientAction} className="space-y-4">
          <input type="hidden" name="recipeId" value={recipeId} />

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Date</label>
            <input
              type="date"
              name="date"
              defaultValue={dateValue}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Add to Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
