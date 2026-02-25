import ShoppingList from "@/components/shopping/ShoppingList";
import prisma from "@/lib/prisma";
import { getCurrentAccessContext } from "@/lib/household";
import { getUpcomingRange, toDateKey } from "@/lib/date";
import { buildShoppingList } from "@/lib/shopping";
import { coerceStringArray } from "@/lib/recipe-utils";
import {
  buildHouseholdJoinUrl,
  getCurrentHouseholdShareLink,
} from "@/lib/household-access";
import {
  listShoppingItems,
  listShoppingLocationPreferences,
} from "@/lib/shopping-list";

export const revalidate = 30;

export default async function ShoppingPage() {
  const { start, end } = getUpcomingRange();
  const accessContext = await getCurrentAccessContext();
  const householdId = accessContext.householdId;

  const [mealPlans, persistedItems, locationPreferences, shareInviteUrl] = await Promise.all([
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
    listShoppingLocationPreferences(householdId),
    accessContext.canManageLink
      ? getCurrentHouseholdShareLink(householdId).then((shareLink) =>
          buildHouseholdJoinUrl(shareLink.token, "/shopping")
        )
      : Promise.resolve(null),
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
      categories={categories}
      persistedItems={persistedItems}
      locationPreferences={locationPreferences}
      shareInviteUrl={shareInviteUrl}
    />
  );
}
