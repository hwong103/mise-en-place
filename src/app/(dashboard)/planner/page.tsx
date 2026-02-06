import Link from "next/link";

import prisma from "@/lib/prisma";
import { getWeekRange, toDateKey, fromDateKey } from "@/lib/date";
import { getDefaultHouseholdId } from "@/lib/household";
import { listRecipes } from "@/lib/recipes";
import PlannerBoard from "@/components/planner/PlannerBoard";

export const revalidate = 60;

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

  const hasRecipes = recipes.length > 0;
  const slots = mealPlans.map((plan) => ({
    dateKey: toDateKey(plan.date),
    mealType: plan.mealType,
    recipeId: plan.recipeId,
    recipeTitle: plan.recipe?.title ?? null,
  }));

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

      <PlannerBoard
        days={days.map((day, index) => ({
          dateKey: dateKeys[index],
          label: formatDate(day),
        }))}
        recipes={recipes.map((recipe) => ({ id: recipe.id, title: recipe.title }))}
        slots={slots}
      />
    </div>
  );
}
