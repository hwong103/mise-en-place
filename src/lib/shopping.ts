export type ShoppingItem = {
  line: string;
  count: number;
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

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

export function buildShoppingList(lines: string[]): ShoppingCategory[] {
  const itemMap = new Map<string, ShoppingItem>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const key = normalize(trimmed);
    if (!key) {
      continue;
    }

    const existing = itemMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      itemMap.set(key, { line: trimmed, count: 1 });
    }
  }

  const categoryMap = new Map<string, ShoppingItem[]>();

  for (const item of itemMap.values()) {
    const category = resolveCategory(item.line);
    const list = categoryMap.get(category) ?? [];
    list.push(item);
    categoryMap.set(category, list);
  }

  return CATEGORY_RULES.map((rule) => {
    const items = categoryMap.get(rule.name) ?? [];
    items.sort((a, b) => a.line.localeCompare(b.line));
    return { name: rule.name, items };
  }).filter((category) => category.items.length > 0);
}
