import { INGREDIENT_TAXONOMY } from "@/lib/ingredient-taxonomy";

export type IngredientCategory = "Produce" | "Dairy" | "Meat" | "Pantry" | "Other";

export type IngredientClassification = {
  category: IngredientCategory;
  canonical: string;
  matchedBy: "alias" | "canonical" | "override" | "fallback";
};

type TaxonomyRecord = {
  canonical: string;
  category: IngredientCategory;
  aliases: string[];
};

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
  "cm",
  "mm",
  "meter",
  "meters",
  "stalk",
  "stalks",
  "bunch",
  "bunches",
  "sprig",
  "sprigs",
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
  "roughly",
  "finely",
  "thinly",
  "thickly",
  "coarsely",
  "small",
  "medium",
  "large",
  "whole",
  "raw",
  "ripe",
  "extra",
  "virgin",
  "boneless",
  "skinless",
  "halved",
  "chopped",
  "diced",
  "minced",
  "sliced",
  "peeled",
  "grated",
  "shredded",
  "ground",
]);

const STORAGE_FORM_WORDS = new Set([
  "can",
  "cans",
  "canned",
  "tinned",
  "dried",
  "jar",
  "jars",
  "jarred",
  "powder",
  "paste",
  "frozen",
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isQuantityToken = (token: string) => {
  return /^\d+(?:[./]\d+)?$/.test(token) || /^\d+\/\d+$/.test(token);
};

const singularizeToken = (token: string) => {
  if (token.endsWith("ies") && token.length > 3) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("oes") && token.length > 3) {
    return `${token.slice(0, -2)}`;
  }

  if (/(ches|shes|sses|xes|zes)$/.test(token) && token.length > 4) {
    return token.slice(0, -2);
  }

  if (
    token.endsWith("s") &&
    token.length > 3 &&
    !token.endsWith("ss") &&
    !token.endsWith("us") &&
    !token.endsWith("is")
  ) {
    return token.slice(0, -1);
  }

  return token;
};

const normalizePhrase = (value: string) =>
  normalize(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => singularizeToken(token))
    .join(" ");

const stripLeadingMeasureTokens = (tokens: string[]) => {
  let start = 0;
  while (start < tokens.length) {
    const token = tokens[start];
    if (isQuantityToken(token) || UNIT_WORDS.has(token) || token === "x") {
      start += 1;
      continue;
    }
    break;
  }
  return tokens.slice(start);
};

const buildFallbackCanonical = (line: string) => {
  const normalized = normalizePhrase(line);
  if (!normalized) {
    return "";
  }

  const tokens = stripLeadingMeasureTokens(normalized.split(" ").filter(Boolean))
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => token.length > 1);

  if (tokens.length === 0) {
    return normalized;
  }

  return Array.from(new Set(tokens)).join(" ");
};

const buildCandidatePhrases = (line: string) => {
  const normalized = normalize(line);
  if (!normalized) {
    return [];
  }

  const seen = new Set<string>();
  const candidates: string[] = [];
  const pushCandidate = (value: string) => {
    const phrase = normalizePhrase(value);
    if (!phrase || seen.has(phrase)) {
      return;
    }
    seen.add(phrase);
    candidates.push(phrase);
  };

  pushCandidate(normalized);

  const segments = normalized.split(",").map((segment) => segment.trim()).filter(Boolean);
  for (const segment of segments) {
    pushCandidate(segment);

    const tokens = stripLeadingMeasureTokens(normalizePhrase(segment).split(" ").filter(Boolean));
    if (tokens.length === 0) {
      continue;
    }

    pushCandidate(tokens.join(" "));

    const maxGram = Math.min(tokens.length, 4);
    for (let size = maxGram; size >= 1; size -= 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        pushCandidate(tokens.slice(index, index + size).join(" "));
      }
    }
  }

  return candidates;
};

const hasStorageForm = (line: string) => {
  const tokens = normalize(line).split(" ").filter(Boolean);
  return tokens.some((token) => STORAGE_FORM_WORDS.has(token));
};

const TAXONOMY: TaxonomyRecord[] = INGREDIENT_TAXONOMY.map((entry) => ({
  canonical: normalizePhrase(entry.canonical),
  category: entry.category,
  aliases: entry.aliases.map((alias) => normalizePhrase(alias)).filter(Boolean),
}));

const ALIAS_INDEX = new Map<string, TaxonomyRecord>();
const CANONICAL_INDEX = new Map<string, TaxonomyRecord>();
const HEAD_TOKEN_INDEX = new Map<string, TaxonomyRecord>();

for (const entry of TAXONOMY) {
  CANONICAL_INDEX.set(entry.canonical, entry);

  const canonicalHead = entry.canonical.split(" ")[0];
  if (canonicalHead && !HEAD_TOKEN_INDEX.has(canonicalHead)) {
    HEAD_TOKEN_INDEX.set(canonicalHead, entry);
  }

  for (const alias of entry.aliases) {
    if (!ALIAS_INDEX.has(alias)) {
      ALIAS_INDEX.set(alias, entry);
    }

    const aliasHead = alias.split(" ")[0];
    if (aliasHead && alias.split(" ").length === 1 && !HEAD_TOKEN_INDEX.has(aliasHead) && !STOP_WORDS.has(aliasHead)) {
      HEAD_TOKEN_INDEX.set(aliasHead, entry);
    }
  }
}

const classifyMatchedEntry = (
  entry: TaxonomyRecord,
  matchType: "alias" | "canonical" | "fallback",
  storageOverride: boolean
): IngredientClassification => {
  if (storageOverride && entry.category === "Produce") {
    return {
      category: "Pantry",
      canonical: entry.canonical,
      matchedBy: "override",
    };
  }

  return {
    category: entry.category,
    canonical: entry.canonical,
    matchedBy: matchType,
  };
};

export function classifyIngredient(line: string): IngredientClassification {
  const normalized = normalize(line);
  if (!normalized) {
    return {
      category: "Other",
      canonical: "",
      matchedBy: "fallback",
    };
  }

  const candidates = buildCandidatePhrases(line);
  const storageOverride = hasStorageForm(line);

  for (const candidate of candidates) {
    const aliasMatch = ALIAS_INDEX.get(candidate);
    if (aliasMatch) {
      return classifyMatchedEntry(aliasMatch, "alias", storageOverride);
    }

    const canonicalMatch = CANONICAL_INDEX.get(candidate);
    if (canonicalMatch) {
      return classifyMatchedEntry(canonicalMatch, "canonical", storageOverride);
    }
  }

  for (const candidate of candidates) {
    const headToken = candidate.split(" ")[0];
    if (!headToken) {
      continue;
    }

    const headMatch = HEAD_TOKEN_INDEX.get(headToken);
    if (headMatch) {
      return classifyMatchedEntry(headMatch, "fallback", storageOverride);
    }
  }

  return {
    category: "Other",
    canonical: buildFallbackCanonical(line),
    matchedBy: "fallback",
  };
}
