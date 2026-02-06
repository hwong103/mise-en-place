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
  "heat",
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
    .replace(/^\s*(?:[•·▪◦□☐☑■]|\-|\*)\s+/g, "")
    .replace(/^\s*[□☐☑]\s*/g, "")
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

  for (const line of lines) {
    const trimmed = cleanLineBase(line);
    if (!trimmed) {
      continue;
    }
    if (/^\s*notes?\b[:\s-]*/i.test(trimmed)) {
      notes.push(stripNoteText(trimmed));
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
  const groups: PrepGroup[] = [];

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

    groups.push({
      title,
      items: matches.map((match) => match.line),
    });

    matches.forEach((match) => assigned.add(match.line));
  });

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
