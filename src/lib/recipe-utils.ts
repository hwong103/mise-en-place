export type PrepGroup = {
  title: string;
  items: string[];
};

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&#x27;": "'",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&ndash;": "-",
  "&mdash;": "-",
};

const FRACTION_CHAR_MAP: Record<string, string> = {
  "\u00BC": "1/4",
  "\u00BD": "1/2",
  "\u00BE": "3/4",
  "\u2153": "1/3",
  "\u2154": "2/3",
  "\u215B": "1/8",
  "\u215C": "3/8",
  "\u215D": "5/8",
  "\u215E": "7/8",
};

const NOTE_PATTERN = /\(+\s*note[^)]*\)+/gi;
const PAREN_COMMA_PATTERN = /\(\s*,\s*/g;
const EMPTY_PAREN_PATTERN = /\(\s*\)/g;
const SPACE_BEFORE_PAREN_CLOSE = /\s+\)/g;
const MULTI_SPACE_PATTERN = /\s{2,}/g;
const MULTI_OPEN_PAREN = /\({2,}/g;
const MULTI_CLOSE_PAREN = /\){2,}/g;
const TRAILING_OPEN_PAREN = /\(\s*$/g;
const LEADING_CLOSE_PAREN = /^\s*\)/g;

const PREP_VERBS = [
  "mince",
  "chop",
  "slice",
  "dice",
  "grate",
  "shred",
  "mix",
  "whisk",
  "combine",
  "crush",
  "peel",
  "zest",
  "julienne",
  "cube",
  "cut",
  "separate",
  "rinse",
  "wash",
  "pat",
  "trim",
  "soak",
  "marinate",
  "toast",
  "grind",
];

const PREP_ADVERBS = [
  "finely",
  "roughly",
  "thinly",
  "coarsely",
  "gently",
  "quickly",
  "lightly",
];

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
]);

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
]);

const decodeHtmlEntities = (value: string) => {
  const namedDecoded = value.replace(
    /&(?:amp|quot|#39|#x27|lt|gt|nbsp|ndash|mdash);/g,
    (match) => HTML_ENTITY_MAP[match] ?? match
  );
  const decimalDecoded = namedDecoded.replace(/&#(\d+);/g, (_, code) => {
    const parsed = Number.parseInt(code, 10);
    if (!Number.isFinite(parsed)) {
      return "";
    }
    return String.fromCharCode(parsed);
  });
  const hexDecoded = decimalDecoded.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    const parsed = Number.parseInt(code, 16);
    if (!Number.isFinite(parsed)) {
      return "";
    }
    return String.fromCharCode(parsed);
  });

  return hexDecoded.replace(
    /[\u00BC\u00BD\u00BE\u2153\u2154\u215B\u215C\u215D\u215E]/g,
    (match) => FRACTION_CHAR_MAP[match] ?? match
  );
};

const normalizeWhitespace = (value: string) =>
  value.replace(MULTI_SPACE_PATTERN, " ").trim();

const MEASUREMENT_FRACTION_MAP: Record<string, number> = {
  "\u00BC": 0.25,
  "\u00BD": 0.5,
  "\u00BE": 0.75,
  "\u2153": 1 / 3,
  "\u2154": 2 / 3,
  "\u215B": 0.125,
  "\u215C": 0.375,
  "\u215D": 0.625,
  "\u215E": 0.875,
};

const MEASUREMENT_PATTERN =
  /([0-9]+(?:\.[0-9]+)?|[0-9]+\s+[0-9]+\/[0-9]+|[0-9]+\/[0-9]+|[0-9]+[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞])(?:\s*(?:-|–|—|to)\s*([0-9]+(?:\.[0-9]+)?|[0-9]+\s+[0-9]+\/[0-9]+|[0-9]+\/[0-9]+|[0-9]+[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]))?\s*[- ]?\s*(pounds?|lbs?\.?|lb\.?|ounces?|oz\.?)\b\.?/gi;

const parseMeasurementAmount = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (MEASUREMENT_FRACTION_MAP[trimmed] !== undefined) {
    return MEASUREMENT_FRACTION_MAP[trimmed];
  }

  const mixedFractionMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedFractionMatch) {
    const whole = Number(mixedFractionMatch[1]);
    const numerator = Number(mixedFractionMatch[2]);
    const denominator = Number(mixedFractionMatch[3]);
    if (denominator !== 0) {
      return whole + numerator / denominator;
    }
  }

  const compactMixedFractionMatch = trimmed.match(/^(\d+)([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (compactMixedFractionMatch) {
    const whole = Number(compactMixedFractionMatch[1]);
    const fraction = MEASUREMENT_FRACTION_MAP[compactMixedFractionMatch[2]];
    return Number.isFinite(whole) && fraction !== undefined ? whole + fraction : null;
  }

  const compactAsciiMixedFractionMatch = trimmed.match(/^(\d+)(\d)\/(\d+)$/);
  if (compactAsciiMixedFractionMatch) {
    const whole = Number(compactAsciiMixedFractionMatch[1]);
    const numerator = Number(compactAsciiMixedFractionMatch[2]);
    const denominator = Number(compactAsciiMixedFractionMatch[3]);
    if (denominator !== 0 && numerator < denominator) {
      return whole + numerator / denominator;
    }
  }

  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator !== 0) {
      return numerator / denominator;
    }
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMergedFractionAsMixed = (raw: string, maxValue: number) => {
  const normalized = raw.trim();
  const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (!fractionMatch) {
    return null;
  }

  const numeratorDigits = fractionMatch[1];
  const denominator = Number(fractionMatch[2]);
  if (numeratorDigits.length < 2 || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  const whole = Number(numeratorDigits.slice(0, -1));
  const numerator = Number(numeratorDigits.slice(-1));
  if (!Number.isFinite(whole) || !Number.isFinite(numerator) || numerator >= denominator) {
    return null;
  }

  const candidate = whole + numerator / denominator;
  return candidate <= maxValue ? candidate : null;
};

const formatAmount = (value: number, decimals: number) => {
  const rounded = Number(value.toFixed(decimals));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
};

const convertToMetricAmount = (amount: number, normalizedUnit: string) => {
  if (normalizedUnit === "lb" || normalizedUnit === "pound") {
    const kilograms = amount * 0.45359237;
    if (kilograms < 1) {
      return { amount: Math.round(kilograms * 1000), unit: "g" };
    }
    return { amount: Number(kilograms.toFixed(1)), unit: "kg" };
  }

  if (normalizedUnit === "oz" || normalizedUnit === "ounce") {
    return { amount: Math.round(amount * 28.349523125), unit: "g" };
  }

  return null;
};

const normalizeMeasurementUnit = (value: string) =>
  value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, "");

const getMeasurementUnitBase = (normalizedUnit: string) => {
  if (normalizedUnit === "lb" || normalizedUnit === "lbs" || normalizedUnit === "pound" || normalizedUnit === "pounds") {
    return "lb";
  }
  if (normalizedUnit === "oz" || normalizedUnit === "ounce" || normalizedUnit === "ounces") {
    return "oz";
  }
  return null;
};

export const convertIngredientMeasurementToMetric = (line: string) => {
  return line.replace(
    MEASUREMENT_PATTERN,
    (match, rawFirst: string, rawSecond: string | undefined, rawUnit: string, offset: number, input: string) => {
      const previousChar = offset > 0 ? input[offset - 1] : "";
      if (previousChar && /[A-Za-z0-9/]/.test(previousChar)) {
        return match;
      }

      let firstAmount = parseMeasurementAmount(rawFirst);
      if (firstAmount === null) {
        return match;
      }

      let secondAmount = rawSecond ? parseMeasurementAmount(rawSecond) : null;
      if (secondAmount !== null && firstAmount > secondAmount) {
        const fallbackMixed = parseMergedFractionAsMixed(rawFirst, secondAmount);
        if (fallbackMixed !== null) {
          firstAmount = fallbackMixed;
        }
      }

      const normalizedUnit = normalizeMeasurementUnit(rawUnit);
      const unitBase = getMeasurementUnitBase(normalizedUnit);
      if (!unitBase) {
        return match;
      }

      const firstConverted = convertToMetricAmount(firstAmount, unitBase);
      if (!firstConverted) {
        return match;
      }

      const formattedFirst = formatAmount(
        firstConverted.amount,
        firstConverted.unit === "kg" ? 1 : 0
      );
      if (secondAmount === null) {
        return `${formattedFirst} ${firstConverted.unit}`;
      }

      const secondConverted = convertToMetricAmount(secondAmount, unitBase);
      if (!secondConverted || secondConverted.unit !== firstConverted.unit) {
        return match;
      }

      const formattedSecond = formatAmount(
        secondConverted.amount,
        secondConverted.unit === "kg" ? 1 : 0
      );
      return `${formattedFirst}-${formattedSecond} ${firstConverted.unit}`;
    }
  );
};

const stripNoteText = (value: string) => value.replace(/^note[:\s-]*/i, "Note ").trim();

const extractNotesFromLine = (line: string) => {
  const notes: string[] = [];
  const matches = line.matchAll(NOTE_PATTERN);
  for (const match of matches) {
    if (match[1]) {
      notes.push(stripNoteText(match[1]));
    }
  }
  return notes;
};

const balanceParentheses = (value: string) => {
  const openCount = (value.match(/\(/g) ?? []).length;
  const closeCount = (value.match(/\)/g) ?? []).length;
  if (openCount === closeCount) {
    return value;
  }
  if (openCount > closeCount) {
    return `${value}${")".repeat(openCount - closeCount)}`;
  }
  let trimmed = value;
  let diff = closeCount - openCount;
  while (diff > 0) {
    trimmed = trimmed.replace(/\)\s*$/, "");
    diff -= 1;
  }
  return trimmed;
};

const cleanLineBase = (line: string) => {
  const cleaned = decodeHtmlEntities(line)
    .replace(/^\s*\[\s*[xX]?\s*\]\s*/g, "")
    .replace(/^\s*(?:[•·▪◦□☐☑■]|\-|\*)\s+/g, "")
    .replace(/^\s*[□☐☑■]\s*/g, "")
    .replace(/[\u2610-\u2612\u25A0-\u25A9\u25AA\u25AB\u25FB\u25FC]/g, "")
    .replace(PAREN_COMMA_PATTERN, "(")
    .replace(EMPTY_PAREN_PATTERN, "")
    .replace(SPACE_BEFORE_PAREN_CLOSE, ")")
    .replace(MULTI_OPEN_PAREN, "(")
    .replace(MULTI_CLOSE_PAREN, ")")
    .replace(TRAILING_OPEN_PAREN, "")
    .replace(LEADING_CLOSE_PAREN, "");

  return normalizeWhitespace(balanceParentheses(cleaned));
};

export const cleanIngredientLine = (line: string) => {
  const notes = extractNotesFromLine(line);
  const cleaned = cleanLineBase(line).replace(NOTE_PATTERN, "").trim();
  return {
    line: normalizeWhitespace(cleaned),
    notes,
  };
};

export const cleanIngredientLines = (lines: string[]) => {
  const cleanedLines: string[] = [];
  const notes: string[] = [];

  for (const line of lines) {
    const result = cleanIngredientLine(line);
    if (result.line) {
      cleanedLines.push(result.line);
    }
    notes.push(...result.notes);
  }

  return {
    lines: cleanedLines,
    notes,
  };
};

export const cleanInstructionLines = (lines: string[]) => {
  const cleanedLines: string[] = [];
  const notes: string[] = [];
  const metadataLinePattern =
    /^(?:course|cuisine|keyword|keywords|servings?|yield|author|calories|prep(?:\s+time)?|cook(?:\s+time)?|total(?:\s+time)?|equipment)\b[:\s-]*/i;

  for (const line of lines) {
    const trimmed = cleanLineBase(line);
    if (!trimmed) {
      continue;
    }
    if (/^\s*notes?\b[:\s-]*/i.test(trimmed)) {
      notes.push(stripNoteText(trimmed));
      continue;
    }
    if (metadataLinePattern.test(trimmed)) {
      continue;
    }
    cleanedLines.push(trimmed);
  }

  return {
    lines: cleanedLines,
    notes,
  };
};

export const cleanTextLines = (lines: string[]) =>
  lines
    .map((line) => cleanLineBase(line))
    .filter(Boolean);

const extractIngredientKeywords = (line: string) => {
  const withoutParens = line.replace(/\([^)]*\)/g, " ");
  const cleaned = withoutParens.replace(/[^a-zA-Z0-9\s]/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !UNIT_WORDS.has(token))
    .filter((token) => !/^\d/.test(token))
    .filter((token) => token.length > 2);

  return Array.from(new Set(tokens));
};

const INGREDIENT_PREP_HINTS: Array<{ title: string; pattern: RegExp }> = [
  { title: "Slice", pattern: /\b(sliced?|thinly\s+cut)\b/i },
  { title: "Chop", pattern: /\b(chopped?|roughly\s+chopped?)\b/i },
  { title: "Dice", pattern: /\b(diced?)\b/i },
  { title: "Mince", pattern: /\b(minced?)\b/i },
  { title: "Grate", pattern: /\b(grated?)\b/i },
  { title: "Shred", pattern: /\b(shredded?)\b/i },
  { title: "Crush", pattern: /\b(crushed?)\b/i },
  { title: "Peel", pattern: /\b(peeled?)\b/i },
  { title: "Zest", pattern: /\b(zested?)\b/i },
];

const findIngredientPrepTitle = (line: string) => {
  for (const hint of INGREDIENT_PREP_HINTS) {
    if (hint.pattern.test(line)) {
      return hint.title;
    }
  }
  return null;
};

const findPrepPhrase = (instruction: string) => {
  const lower = instruction.toLowerCase();
  for (const verb of PREP_VERBS) {
    const regex = new RegExp(
      `\\b(?:${PREP_ADVERBS.join("|")})?\\s*\\b${verb}\\b`,
      "i"
    );
    const match = lower.match(regex);
    if (match) {
      return match[0].trim();
    }
  }
  return null;
};

const titleCase = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const addToGroupMap = (groupMap: Map<string, string[]>, title: string, items: string[]) => {
  const existing = groupMap.get(title);
  if (!existing) {
    groupMap.set(title, Array.from(new Set(items)));
    return;
  }

  for (const item of items) {
    if (!existing.includes(item)) {
      existing.push(item);
    }
  }
};

export const buildPrepGroupsFromInstructions = (
  ingredients: string[],
  instructions: string[]
) => {
  if (ingredients.length === 0 || instructions.length === 0) {
    return [];
  }

  const ingredientKeywords = ingredients.map((line) => ({
    line,
    keywords: extractIngredientKeywords(line),
  }));
  const assigned = new Set<string>();
  const groupMap = new Map<string, string[]>();

  // Prefer explicit prep hints from ingredient lines ("sliced", "diced", etc)
  // so mise en place reflects actual prep work instead of cooking-stage verbs.
  for (const ingredient of ingredients) {
    const prepTitle = findIngredientPrepTitle(ingredient);
    if (!prepTitle) {
      continue;
    }
    addToGroupMap(groupMap, prepTitle, [ingredient]);
    assigned.add(ingredient);
  }

  instructions.forEach((instruction, index) => {
    const lower = instruction.toLowerCase();
    const matches = ingredientKeywords.filter(
      (ingredient) =>
        !assigned.has(ingredient.line) &&
        ingredient.keywords.some((keyword) => lower.includes(keyword))
    );

    if (matches.length === 0) {
      return;
    }

    const prepPhrase = findPrepPhrase(instruction);
    if (!prepPhrase && !/\bprep\b|\bprepare\b/.test(lower)) {
      return;
    }

    const title = prepPhrase ? titleCase(prepPhrase) : `Step ${index + 1} Prep`;
    addToGroupMap(
      groupMap,
      title,
      matches.map((match) => match.line)
    );

    matches.forEach((match) => assigned.add(match.line));
  });

  const groups: PrepGroup[] = Array.from(groupMap.entries()).map(([title, items]) => ({
    title,
    items,
  }));
  const remaining = ingredients.filter((line) => !assigned.has(line));
  if (groups.length === 0) {
    return [];
  }
  if (remaining.length > 0) {
    groups.push({
      title: "Other Prep",
      items: remaining,
    });
  }

  return groups;
};

export function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function buildPrepGroups(ingredients: string[]): PrepGroup[] {
  if (ingredients.length === 0) {
    return [];
  }

  return [
    {
      title: "Prep",
      items: ingredients,
    },
  ];
}

export function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function coercePrepGroups(value: unknown): PrepGroup[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title : "";
      const items = Array.isArray(record.items)
        ? record.items
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
        : [];

      if (!title || items.length === 0) {
        return null;
      }

      return { title, items } satisfies PrepGroup;
    })
    .filter((entry): entry is PrepGroup => Boolean(entry));
}

export function serializePrepGroupsToText(groups: PrepGroup[]) {
  return groups
    .map((group) => `${group.title}\n${group.items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
}

/** Marker prefix used by LineListEditor to inline section headers in flat lists. */
export const INGREDIENT_HEADER_PREFIX = "## ";

/**
 * Splits a flat ingredient list (possibly containing `## Header` lines) into
 * PrepGroup[]. Returns an empty array if no headers are present.
 */
export function parseGroupsFromIngredientsWithHeaders(lines: string[]): PrepGroup[] {
  const hasHeaders = lines.some((l) => l.startsWith(INGREDIENT_HEADER_PREFIX));
  if (!hasHeaders) return [];

  const groups: PrepGroup[] = [];
  let current: PrepGroup | null = null;

  for (const line of lines) {
    if (line.startsWith(INGREDIENT_HEADER_PREFIX)) {
      const title = line.slice(INGREDIENT_HEADER_PREFIX.length).trim();
      if (title) {
        current = { title, items: [] };
        groups.push(current);
      }
    } else {
      const item = line.trim();
      if (!item) continue;
      if (!current) {
        // Items before any header go into a default group
        current = { title: "Ingredients", items: [] };
        groups.unshift(current);
      }
      current.items.push(item);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

/**
 * Strips `## ` header prefixes from ingredient lines, returning only
 * the actual ingredient strings (for storage in the flat `ingredients` column).
 */
export function stripIngredientHeaders(lines: string[]): string[] {
  return lines.filter((l) => !l.startsWith(INGREDIENT_HEADER_PREFIX));
}

export function parsePrepGroupsFromText(text: string): PrepGroup[] {
  const lines = parseLines(text);
  const groups: PrepGroup[] = [];
  let currentGroup: PrepGroup | null = null;

  for (const line of lines) {
    const isItem = line.startsWith("-") || line.startsWith("*");
    const cleanLine = line.replace(/^[-*]\s*/, "").trim();

    if (!cleanLine) {
      continue;
    }

    if (isItem) {
      if (!currentGroup) {
        currentGroup = { title: "Prep", items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(cleanLine);
    } else {
      currentGroup = { title: cleanLine, items: [] };
      groups.push(currentGroup);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}
