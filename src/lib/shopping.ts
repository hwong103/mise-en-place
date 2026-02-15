import { classifyIngredient, type IngredientCategory } from "@/lib/ingredient-classifier";

export type ShoppingIngredientEntry = {
  line: string;
  recipeTitle?: string | null;
};

export type ShoppingItem = {
  line: string;
  count: number;
  recipes: string[];
};

export type ShoppingCategory = {
  name: string;
  items: ShoppingItem[];
};

const CATEGORY_ORDER: IngredientCategory[] = ["Produce", "Dairy", "Meat", "Pantry", "Other"];

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export function buildShoppingList(entries: ShoppingIngredientEntry[]): ShoppingCategory[] {
  const itemMap = new Map<
    string,
    { line: string; count: number; recipes: Set<string>; category: IngredientCategory }
  >();

  for (const entry of entries) {
    const trimmed = entry.line.trim();
    if (!trimmed) {
      continue;
    }

    const classification = classifyIngredient(trimmed);
    const key = classification.canonical || trimmed.toLowerCase();
    if (!key) {
      continue;
    }

    const existing = itemMap.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.category === "Other" && classification.category !== "Other") {
        existing.category = classification.category;
      }
      if (entry.recipeTitle) {
        existing.recipes.add(entry.recipeTitle);
      }
    } else {
      itemMap.set(key, {
        line: titleCase(key),
        count: 1,
        category: classification.category,
        recipes: new Set(entry.recipeTitle ? [entry.recipeTitle] : []),
      });
    }
  }

  const categoryMap = new Map<IngredientCategory, ShoppingItem[]>();

  for (const item of itemMap.values()) {
    const list = categoryMap.get(item.category) ?? [];
    list.push({
      line: item.line,
      count: item.count,
      recipes: Array.from(item.recipes).sort((a, b) => a.localeCompare(b)),
    });
    categoryMap.set(item.category, list);
  }

  return CATEGORY_ORDER.map((category) => {
    const items = categoryMap.get(category) ?? [];
    items.sort((a, b) => a.line.localeCompare(b.line));
    return { name: category, items };
  }).filter((category) => category.items.length > 0);
}
