import ShoppingList from "@/components/shopping/ShoppingList";
import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";
import { fromDateKey, getWeekRange, toDateKey } from "@/lib/date";
import { buildShoppingList } from "@/lib/shopping";
import { coerceStringArray } from "@/lib/recipe-utils";
import { listShoppingItems } from "@/lib/shopping-list";

export const revalidate = 30;

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function ShoppingPage() {
  const { start, end } = getWeekRange();
  const startDate = fromDateKey(toDateKey(start));
  const endDate = fromDateKey(toDateKey(end));
  const householdId = await getDefaultHouseholdId();

  const [mealPlans, persistedItems] = await Promise.all([
    prisma.mealPlan.findMany({
      where: {
        householdId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { recipe: true },
    }),
    listShoppingItems(startDate, householdId),
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
