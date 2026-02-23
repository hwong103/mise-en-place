import { classifyIngredient, type IngredientCategory } from "@/lib/ingredient-classifier";

export type ShoppingIngredientEntry = {
  line: string;
  recipeTitle?: string | null;
};

export type ShoppingItem = {
  line: string;
  count: number;
  amountSummary?: string;
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

const normalizeAmountText = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*(,|;)\s*/g, "$1 ")
    .trim();

const extractAmountText = (line: string) => {
  const normalized = normalizeAmountText(line);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(" ").filter(Boolean);
  const amountTokens: string[] = [];

  for (const token of parts) {
    if (/^\d+(?:[./]\d+)?$/.test(token) || /^\d+\/\d+$/.test(token) || token === "x") {
      amountTokens.push(token);
      continue;
    }

    if (/^\d+(?:[./]\d+)?(?:g|kg|mg|ml|l|oz|lb|lbs)$/.test(token)) {
      amountTokens.push(token);
      continue;
    }

    if (/^(g|kg|mg|ml|l|oz|lb|lbs|pound|pounds|tbsp|tsp|cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|clove|cloves|pinch|dash|can|cans|package|packages|slice|slices|stalk|stalks|bunch|bunches|sprig|sprigs)$/.test(token)) {
      amountTokens.push(token);
      continue;
    }

    break;
  }

  if (amountTokens.length === 0) {
    return null;
  }

  return amountTokens.join(" ");
};

export function buildShoppingList(entries: ShoppingIngredientEntry[]): ShoppingCategory[] {
  const itemMap = new Map<
    string,
    { line: string; count: number; amounts: Set<string>; recipes: Set<string>; category: IngredientCategory }
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

    const amountText = extractAmountText(trimmed);
    const existing = itemMap.get(key);
    if (existing) {
      existing.count += 1;
      if (amountText) {
        existing.amounts.add(amountText);
      }
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
        amounts: new Set(amountText ? [amountText] : []),
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
      amountSummary: Array.from(item.amounts)
        .sort((a, b) => a.localeCompare(b))
        .join(" + "),
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
