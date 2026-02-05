import ShoppingActions from "@/components/shopping/ShoppingActions";
import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";
import { fromDateKey, getWeekRange, toDateKey } from "@/lib/date";
import { buildShoppingList } from "@/lib/shopping";
import { coerceStringArray } from "@/lib/recipe-utils";

export const dynamic = "force-dynamic";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function ShoppingPage() {
  const { start, end } = getWeekRange();
  const startDate = fromDateKey(toDateKey(start));
  const endDate = fromDateKey(toDateKey(end));
  const householdId = await getDefaultHouseholdId();

  const mealPlans = await prisma.mealPlan.findMany({
    where: {
      householdId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: { recipe: true },
  });

  const ingredientLines = mealPlans.flatMap((plan) =>
    coerceStringArray(plan.recipe.ingredients),
  );
  const categories = buildShoppingList(ingredientLines);
  const shareText =
    categories.length === 0
      ? "No items in the shopping list yet."
      : [
          `Shopping List (${formatDate(start)} - ${formatDate(end)})`,
          "",
          ...categories.map((category) => {
            const items = category.items
              .map((item) =>
                item.count > 1 ? `- ${item.line} (x${item.count})` : `- ${item.line}`,
              )
              .join("\n");
            return `${category.name}\n${items}`;
          }),
        ].join("\n\n");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Shopping List</h1>
          <p className="text-slate-500">Confirm what you have and what you need.</p>
        </div>
        <ShoppingActions shareText={shareText} />
      </div>

      {ingredientLines.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          No ingredients yet. Add meals in the planner to generate your list.
        </div>
      ) : (
        <div className="max-w-3xl space-y-8">
          {categories.map((category) => (
            <div key={category.name} className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">{category.name}</h3>
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <ul className="divide-y divide-slate-100">
                  {category.items.map((item) => (
                    <li key={item.line} className="flex items-center justify-between px-6 py-4 text-sm text-slate-700">
                      <label className="flex items-center gap-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                        <span>{item.line}</span>
                      </label>
                      {item.count > 1 ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          x{item.count}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
