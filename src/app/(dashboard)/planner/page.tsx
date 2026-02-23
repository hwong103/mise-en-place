import Link from "next/link";

import prisma from "@/lib/prisma";
import { getUpcomingRange, toDateKey } from "@/lib/date";
import { getCurrentHouseholdId } from "@/lib/household";
import { listRecipeTitles } from "@/lib/recipes";
import PlannerBoard from "@/components/planner/PlannerBoard";

export const revalidate = 30;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export default async function PlannerPage() {
  const { days } = getUpcomingRange();
  const dateKeys = days.map((day) => toDateKey(day));

  const householdId = await getCurrentHouseholdId();
  const [recipes, mealPlans] = await Promise.all([
    listRecipeTitles(householdId),
    prisma.mealPlan.findMany({
      where: {
        householdId,
        date: { in: days },
        mealType: "DINNER",
      },
      include: {
        recipe: true,
      },
    }),
  ]);

  const hasRecipes = recipes.length > 0;
  const slots = mealPlans.map((plan) => ({
    dateKey: toDateKey(plan.date),
    recipeId: plan.recipeId,
    recipeTitle: plan.recipe?.title ?? null,
    recipeImageUrl: plan.recipe?.imageUrl ?? null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Planner</h1>
          <p className="text-slate-500 dark:text-slate-400">Plan one recipe per day for the next 7 days.</p>
        </div>
        <Link
          href="/shopping"
          className="rounded-xl bg-emerald-600 px-6 py-2.5 font-bold text-white shadow-lg transition-transform active:scale-95"
        >
          Generate Shopping List
        </Link>
      </div>

      {!hasRecipes ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Add a few recipes first so you can plan meals.
          <Link href="/recipes" className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
            Go to Recipes
          </Link>
        </div>
      ) : null}

      <PlannerBoard
        days={days.map((day, index) => ({
          dateKey: dateKeys[index],
          label: formatDate(day),
        }))}
        recipes={recipes.map((recipe) => ({ id: recipe.id, title: recipe.title, imageUrl: recipe.imageUrl ?? null }))}
        slots={slots}
      />
    </div>
  );
}
