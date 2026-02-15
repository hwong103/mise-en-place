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

  const ingredientEntries = mealPlans.flatMap((plan) => {
    const recipeTitle = plan.recipe?.title ?? null;
    const ingredients = plan.recipe ? coerceStringArray(plan.recipe.ingredients) : [];
    return ingredients.map((line) => ({ line, recipeTitle }));
  });

  const categories = buildShoppingList(ingredientEntries);
  return (
    <ShoppingList
      weekKey={toDateKey(start)}
      weekLabel={`${formatDate(start)} - ${formatDate(end)}`}
      categories={categories}
      persistedItems={persistedItems}
    />
  );
}
