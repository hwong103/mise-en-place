"use client";

import { useCallback, useId, useRef, useState } from "react";
import { addToMealPlan } from "@/app/(dashboard)/recipes/actions";
import { toDateKey } from "@/lib/date";
import { useAccessibleDialog } from "@/components/ui/useAccessibleDialog";

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const dateSelectorId = useId();

  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate ?? today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date();
    day.setDate(day.getDate() + i);
    return {
      key: toDateKey(day),
      label: i === 0 ? "Today" : day.toLocaleDateString("en-AU", { weekday: "short" }),
      day: day.toLocaleDateString("en-AU", { day: "numeric" }),
      month: day.toLocaleDateString("en-AU", { month: "short" }),
    };
  });

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    isOpen,
    onClose: closeDialog,
    initialFocusRef: cancelButtonRef,
  });

  async function clientAction(formData: FormData) {
    setIsPending(true);
    try {
      await addToMealPlan(formData);
      setIsOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ??
          "ui-button ui-button-secondary rounded-xl px-4 py-2 text-sm"
        }
      >
        {triggerLabel}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeDialog();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900"
      >
        <h3 id={dialogTitleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Add to Planner
        </h3>
        <p id={dialogDescriptionId} className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Schedule <span className="font-semibold text-emerald-600 dark:text-emerald-400">{recipeTitle}</span> for a day.
        </p>

        <form action={clientAction} className="space-y-4">
          <input type="hidden" name="recipeId" value={recipeId} />
          <input type="hidden" name="date" value={selectedDate} />
          <fieldset className="space-y-2">
            <legend id={dateSelectorId} className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Choose a day
            </legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-labelledby={dateSelectorId}>
            {days.map((day) => {
              const isSelected = selectedDate === day.key;
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => setSelectedDate(day.key)}
                  aria-pressed={isSelected}
                  aria-label={`Schedule for ${day.label} ${day.day} ${day.month}`}
                  className={`flex flex-col items-center rounded-2xl border py-3 transition-colors sm:py-4 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-emerald-500/50"
                  }`}
                >
                  <span className="whitespace-nowrap text-xs font-bold leading-tight">{day.label}</span>
                  <span
                    className={`mt-1 text-base font-semibold leading-none ${
                      isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {day.day}
                  </span>
                  <span
                    className={`mt-0.5 whitespace-nowrap text-[11px] leading-tight ${
                      isSelected ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {day.month}
                  </span>
                </button>
              );
            })}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-4">
            <button
              ref={cancelButtonRef}
              type="button"
              onClick={closeDialog}
              disabled={isPending}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-[var(--accent)] px-6 py-2 text-sm font-bold text-white shadow-lg transition-transform hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Add to Planner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
