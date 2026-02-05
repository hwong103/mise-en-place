import Link from "next/link";

import prisma from "@/lib/prisma";
import { getWeekRange, toDateKey, fromDateKey } from "@/lib/date";
import { getDefaultHouseholdId } from "@/lib/household";
import { listRecipes } from "@/lib/recipes";

import { upsertMealPlan } from "./actions";

export const dynamic = "force-dynamic";

const MEAL_TYPES = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snack" },
] as const;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default async function PlannerPage() {
  const recipes = await listRecipes();
  const { days } = getWeekRange();
  const dateKeys = days.map((day) => toDateKey(day));
  const weekDates = dateKeys.map((key) => fromDateKey(key));

  const householdId = await getDefaultHouseholdId();
  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      householdId,
      date: { in: weekDates },
    },
    include: {
      recipe: true,
    },
  });

  const planMap = new Map(
    mealPlans.map((plan) => [`${toDateKey(plan.date)}-${plan.mealType}`, plan] as const)
  );
  const hasRecipes = recipes.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Weekly Planner</h1>
          <p className="text-slate-500">Assign recipes to meals and generate your shopping list.</p>
        </div>
        <Link
          href="/shopping"
          className="rounded-xl bg-indigo-600 px-6 py-2.5 font-bold text-white shadow-lg transition-transform active:scale-95"
        >
          Generate Shopping List
        </Link>
      </div>

      {!hasRecipes ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Add a few recipes first so you can plan meals for the week.
          <Link href="/recipes" className="ml-2 font-semibold text-indigo-600">
            Go to Recipes
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        {days.map((day, index) => {
          const dateKey = dateKeys[index];
          return (
            <div
              key={dateKey}
              className="flex flex-col space-y-4 rounded-3xl border border-slate-200 bg-white p-4"
            >
              <div className="text-center">
                <p className="text-[11px] uppercase tracking-widest text-slate-400">
                  {formatDate(day)}
                </p>
              </div>
              <div className="space-y-3">
                {MEAL_TYPES.map((mealType) => {
                  const planKey = `${dateKey}-${mealType.value}`;
                  const plan = planMap.get(planKey as any);
                  return (
                    <form
                      key={planKey}
                      action={upsertMealPlan}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                    >
                      <input type="hidden" name="date" value={dateKey} />
                      <input type="hidden" name="mealType" value={mealType.value} />
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{mealType.label}</span>
                        <button
                          type="submit"
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500"
                        >
                          Save
                        </button>
                      </div>
                      <select
                        name="recipeId"
                        defaultValue={plan?.recipeId ?? ""}
                        disabled={!hasRecipes}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="">No recipe</option>
                        {recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.title}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {plan?.recipe?.title ?? "Not planned yet."}
                      </p>
                    </form>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
