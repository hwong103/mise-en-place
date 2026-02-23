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

const parseFraction = (value: string) => {
  if (!/^\d+\/\d+$/.test(value)) {
    return null;
  }
  const [numeratorText, denominatorText] = value.split("/");
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

const parseAmountValue = (tokens: string[]) => {
  if (tokens.length === 0) {
    return null;
  }

  const first = tokens[0];
  const compactMatch = first.match(/^(\d+(?:\.\d+)?)([a-z]+)$/i);
  if (compactMatch) {
    const numeric = Number(compactMatch[1]);
    if (!Number.isFinite(numeric)) {
      return null;
    }
    return {
      value: numeric,
      consumedTokens: 1,
      inlineUnit: compactMatch[2].toLowerCase(),
    };
  }

  if (/^\d+(?:\.\d+)?$/.test(first)) {
    const whole = Number(first);
    if (!Number.isFinite(whole)) {
      return null;
    }

    if (tokens.length > 1) {
      const fractional = parseFraction(tokens[1]);
      if (fractional !== null) {
        return {
          value: whole + fractional,
          consumedTokens: 2,
        };
      }
    }

    return { value: whole, consumedTokens: 1 };
  }

  const fraction = parseFraction(first);
  if (fraction !== null) {
    return { value: fraction, consumedTokens: 1, inlineUnit: "" };
  }

  return null;
};

const formatAmountNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
};

const aggregateAmountTexts = (amounts: string[]) => {
  if (amounts.length === 0) {
    return undefined;
  }

  const numericByUnit = new Map<string, number>();
  const unstructured: string[] = [];

  for (const amount of amounts) {
    const parts = amount.split(" ").filter(Boolean);
    const parsed = parseAmountValue(parts);
    if (!parsed) {
      unstructured.push(amount);
      continue;
    }

    const unitFromRemaining = parts.slice(parsed.consumedTokens).join(" ").trim();
    const inlineUnit =
      "inlineUnit" in parsed && typeof parsed.inlineUnit === "string" ? parsed.inlineUnit : "";
    const unit = (inlineUnit || unitFromRemaining).trim();
    const unitKey = unit || "__count__";
    numericByUnit.set(unitKey, (numericByUnit.get(unitKey) ?? 0) + parsed.value);
  }

  const numericSummaries = Array.from(numericByUnit.entries())
    .map(([unit, total]) => `${formatAmountNumber(total)}${unit === "__count__" ? "" : ` ${unit}`}`)
    .sort((a, b) => a.localeCompare(b));

  const mixed = [...numericSummaries, ...unstructured];
  return mixed.length > 0 ? mixed.join(" + ") : undefined;
};

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
    { line: string; count: number; amounts: string[]; recipes: Set<string>; category: IngredientCategory }
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
        existing.amounts.push(amountText);
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
        amounts: amountText ? [amountText] : [],
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
      amountSummary: aggregateAmountTexts(item.amounts),
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
