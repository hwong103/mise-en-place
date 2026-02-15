import ShoppingList from "@/components/shopping/ShoppingList";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { getUpcomingRange, toDateKey } from "@/lib/date";
import { buildShoppingList } from "@/lib/shopping";
import { coerceStringArray } from "@/lib/recipe-utils";
import { listShoppingItems } from "@/lib/shopping-list";

export const revalidate = 30;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function ShoppingPage() {
  const { start, end } = getUpcomingRange();
  const householdId = await getCurrentHouseholdId();

  const [mealPlans, persistedItems] = await Promise.all([
    prisma.mealPlan.findMany({
      where: {
        householdId,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: { recipe: true },
    }),
    listShoppingItems(start, householdId),
  ]);

  const ingredientLines = mealPlans.flatMap((plan) =>
    plan.recipe ? coerceStringArray(plan.recipe.ingredients) : [],
  );
  const categories = buildShoppingList(ingredientLines);
  return (
    <ShoppingList
      weekKey={toDateKey(start)}
      weekLabel={`${formatDate(start)} - ${formatDate(end)}`}
      categories={categories}
      persistedItems={persistedItems}
    />
  );
}
