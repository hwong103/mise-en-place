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

type CategoryRule = {
  name: string;
  keywords: string[];
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    name: "Produce",
    keywords: [
      "apple",
      "banana",
      "basil",
      "carrot",
      "cilantro",
      "garlic",
      "ginger",
      "green onion",
      "lemon",
      "lime",
      "lettuce",
      "onion",
      "pepper",
      "potato",
      "spinach",
      "tomato",
    ],
  },
  {
    name: "Dairy",
    keywords: ["butter", "cheese", "cream", "milk", "yogurt"],
  },
  {
    name: "Meat",
    keywords: [
      "bacon",
      "beef",
      "chicken",
      "fish",
      "lamb",
      "pork",
      "sausage",
      "shrimp",
      "turkey",
    ],
  },
  {
    name: "Pantry",
    keywords: [
      "beans",
      "broth",
      "canned",
      "flour",
      "oil",
      "pasta",
      "rice",
      "salt",
      "sauce",
      "spice",
      "stock",
      "sugar",
      "vinegar",
    ],
  },
  {
    name: "Other",
    keywords: [],
  },
];

const UNIT_WORDS = new Set([
  "g",
  "kg",
  "mg",
  "ml",
  "l",
  "oz",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "tbsp",
  "tsp",
  "cup",
  "cups",
  "tablespoon",
  "tablespoons",
  "teaspoon",
  "teaspoons",
  "clove",
  "cloves",
  "pinch",
  "dash",
  "package",
  "packages",
  "can",
  "cans",
  "slice",
  "slices",
  "inch",
  "inches",
  "stalk",
  "stalks",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "of",
  "the",
  "to",
  "with",
  "for",
  "each",
  "fresh",
  "freshly",
  "optional",
  "taste",
  "about",
  "approx",
  "part",
  "parts",
  "only",
  "outer",
  "layers",
  "removed",
  "sliced",
  "slice",
  "thick",
  "finely",
  "roughly",
  "minced",
  "peeled",
  "whole",
  "white",
  "black",
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isQuantityToken = (token: string) => /^\d+(?:[./]\d+)?$/.test(token);

const toIngredientKey = (line: string) => {
  const normalized = normalize(line);
  if (!normalized) {
    return "";
  }

  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !isQuantityToken(token))
    .filter((token) => !UNIT_WORDS.has(token))
    .filter((token) => !STOP_WORDS.has(token));

  if (tokens.length === 0) {
    return normalized;
  }

  return Array.from(new Set(tokens)).join(" ");
};

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const resolveCategory = (line: string) => {
  const normalized = normalize(line);
  if (!normalized) {
    return "Other";
  }

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.length === 0) {
      continue;
    }

    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        return rule.name;
      }
    }
  }

  return "Other";
};

export function buildShoppingList(entries: ShoppingIngredientEntry[]): ShoppingCategory[] {
  const itemMap = new Map<string, { line: string; count: number; recipes: Set<string> }>();

  for (const entry of entries) {
    const trimmed = entry.line.trim();
    if (!trimmed) {
      continue;
    }

    const key = toIngredientKey(trimmed);
    if (!key) {
      continue;
    }

    const existing = itemMap.get(key);
    if (existing) {
      existing.count += 1;
      if (entry.recipeTitle) {
        existing.recipes.add(entry.recipeTitle);
      }
    } else {
      itemMap.set(key, {
        line: titleCase(key),
        count: 1,
        recipes: new Set(entry.recipeTitle ? [entry.recipeTitle] : []),
      });
    }
  }

  const categoryMap = new Map<string, ShoppingItem[]>();

  for (const item of itemMap.values()) {
    const category = resolveCategory(item.line);
    const list = categoryMap.get(category) ?? [];
    list.push({
      line: item.line,
      count: item.count,
      recipes: Array.from(item.recipes).sort((a, b) => a.localeCompare(b)),
    });
    categoryMap.set(category, list);
  }

  return CATEGORY_RULES.map((rule) => {
    const items = categoryMap.get(rule.name) ?? [];
    items.sort((a, b) => a.line.localeCompare(b.line));
    return { name: rule.name, items };
  }).filter((category) => category.items.length > 0);
}
