import {
  buildPrepGroups,
  buildPrepGroupsFromInstructions,
  cleanIngredientLines,
  cleanInstructionLines,
  cleanTextLines,
} from "@/lib/recipe-utils";

type ParsedOcrRecipe = {
  title?: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
};

const HEADING_MAP: Record<string, "ingredients" | "instructions" | "notes"> = {
  ingredients: "ingredients",
  ingredient: "ingredients",
  "what you need": "ingredients",
  instructions: "instructions",
  direction: "instructions",
  directions: "instructions",
  method: "instructions",
  steps: "instructions",
  preparation: "instructions",
  notes: "notes",
  tips: "notes",
  "chef's notes": "notes",
};

const OCR_UNIT_WORDS = [
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
];

const OCR_VERBS = [
  "add",
  "stir",
  "mix",
  "cook",
  "bake",
  "heat",
  "simmer",
  "boil",
  "saute",
  "whisk",
  "combine",
  "pour",
  "bring",
  "place",
  "transfer",
  "serve",
  "fold",
  "reduce",
  "season",
  "drain",
];

const OCR_FRACTION_MAP: Record<string, string> = {
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

const OCR_SHORT_WORDS = new Set([
  "a",
  "am",
  "an",
  "as",
  "at",
  "be",
  "by",
  "do",
  "go",
  "he",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "no",
  "of",
  "oh",
  "on",
  "or",
  "so",
  "to",
  "up",
  "us",
  "we",
]);

const UNIT_PATTERN = new RegExp(`\\b(${OCR_UNIT_WORDS.join("|")})\\b`, "i");
const VERB_PATTERN = new RegExp(`\\b(${OCR_VERBS.join("|")})\\b`, "i");
const META_PATTERN = /\b(serves?|yield|prep|cook|total|time)\b/i;
const PAGE_PATTERN = /\bpage\s*\d+\b/i;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseHeading = (line: string) => {
  const normalized = normalize(line);
  for (const [key, section] of Object.entries(HEADING_MAP)) {
    if (normalized === key) {
      return section;
    }
  }
  return null;
};

const parseServings = (line: string) => {
  const match = line.match(/serves\s+(\d+)/i) || line.match(/yield\s+(\d+)/i);
  return match ? Number(match[1]) : undefined;
};

const parseMinutes = (line: string, label: string) => {
  const regex = new RegExp(`${label}[^\d]*(\d+)(?:\s*min)?`, "i");
  const match = line.match(regex);
  return match ? Number(match[1]) : undefined;
};

const splitLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const replaceOcrCharacters = (value: string) => {
  let cleaned = value;
  for (const [glyph, replacement] of Object.entries(OCR_FRACTION_MAP)) {
    cleaned = cleaned.split(glyph).join(replacement);
  }

  return cleaned
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/\u00B0/g, "");
};

const stripLeadingNoiseTokens = (tokens: string[]) => {
  let startIndex = 0;

  while (startIndex < tokens.length) {
    const token = tokens[startIndex];
    const lower = token.toLowerCase();
    const isPunct = /^[^A-Za-z0-9]+$/.test(token);
    const isShortAlpha = /^[A-Za-z]{1,2}$/.test(token);
    const isAllowedShort = OCR_SHORT_WORDS.has(lower) || OCR_UNIT_WORDS.includes(lower);

    if (isPunct) {
      startIndex += 1;
      continue;
    }
    if (isShortAlpha && !isAllowedShort) {
      startIndex += 1;
      continue;
    }
    break;
  }

  return tokens.slice(startIndex);
};

const normalizeOcrLine = (line: string) => {
  const normalized = replaceOcrCharacters(line)
    .replace(/[|]+/g, " ")
    .replace(/_{2,}/g, " ")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const leadingStripped = stripLeadingNoiseTokens(tokens);
  const filtered = leadingStripped.filter((token) => !/^[^A-Za-z0-9]+$/.test(token));

  return filtered.join(" ").trim();
};

const countMatches = (value: string, regex: RegExp) => (value.match(regex) ?? []).length;

const analyzeOcrLine = (line: string) => {
  const cleaned = normalizeOcrLine(line);
  if (!cleaned) {
    return { cleaned, keep: false, score: -1, anchor: false };
  }

  if (PAGE_PATTERN.test(cleaned)) {
    return { cleaned, keep: false, score: -1, anchor: false };
  }

  const totalChars = cleaned.replace(/\s+/g, "").length;
  const letters = countMatches(cleaned, /[A-Za-z]/g);
  const digits = countMatches(cleaned, /\d/g);
  const symbols = countMatches(cleaned, /[^A-Za-z0-9\s]/g);
  const symbolRatio = totalChars > 0 ? symbols / totalChars : 1;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const shortTokens = tokens.filter((token) => token.length <= 2).length;
  const shortRatio = tokens.length > 0 ? shortTokens / tokens.length : 1;
  const singleCharTokens = tokens.filter((token) => token.length === 1).length;
  const singleCharRatio = tokens.length > 0 ? singleCharTokens / tokens.length : 0;

  const lower = cleaned.toLowerCase();
  const hasUnit = UNIT_PATTERN.test(lower);
  const hasVerb = VERB_PATTERN.test(lower);
  const isHeading = Boolean(parseHeading(cleaned));
  const hasMeta = META_PATTERN.test(lower);

  let score = 0;
  if (isHeading) {
    score += 3;
  }
  if (hasMeta) {
    score += 2;
  }
  if (hasUnit) {
    score += 2;
  }
  if (hasVerb) {
    score += 2;
  }
  if (letters >= 6) {
    score += 1;
  }
  if (cleaned.length >= 24) {
    score += 1;
  }
  if (digits > 0 && letters > 0) {
    score += 1;
  }
  if (digits === 0 && tokens.length <= 3 && letters >= 4) {
    score += 1;
  }

  if (symbolRatio > 0.35) {
    score -= 2;
  }
  if (shortRatio > 0.6 && !hasUnit && !isHeading && !hasMeta) {
    score -= 2;
  }
  if (singleCharRatio > 0.4 && !hasUnit && !isHeading && !hasMeta) {
    score -= 2;
  }
  if (cleaned.length <= 3 && !hasUnit && !hasMeta) {
    score -= 2;
  }

  const singleWordKeep =
    tokens.length === 1 && letters >= 4 && symbolRatio <= 0.1 && !PAGE_PATTERN.test(cleaned);

  const anchor = score >= 2;

  if (score >= 2 || singleWordKeep) {
    return { cleaned, keep: true, score, anchor };
  }
  if (score < 1) {
    return { cleaned, keep: false, score, anchor };
  }

  const strongTokens = tokens.filter((token) => token.length >= 3).length;
  const keep = cleaned.length >= 20 || strongTokens >= 2;

  return { cleaned, keep, score, anchor };
};

export function cleanOcrText(text: string) {
  const lines = text.split(/\r?\n/);
  const analyses = lines.map((line) => analyzeOcrLine(line));
  const anchors = analyses
    .map((analysis, index) => (analysis.anchor ? index : -1))
    .filter((index) => index >= 0);
  const startIndex = anchors.length >= 2 ? anchors[0] : 0;
  const endIndex = anchors.length >= 2 ? anchors[anchors.length - 1] : analyses.length - 1;
  const cleanedLines: string[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const analysis = analyses[index];
    if (analysis?.keep) {
      cleanedLines.push(analysis.cleaned);
    }
  }

  return cleanedLines.join("\n").trim();
}

export function parseOcrText(text: string): ParsedOcrRecipe {
  const cleaned = cleanOcrText(text);
  const lines = splitLines(cleaned);
  let title: string | undefined;
  let currentSection: "ingredients" | "instructions" | "notes" | null = null;
  const ingredients: string[] = [];
  const instructions: string[] = [];
  const notes: string[] = [];
  let servings: number | undefined;
  let prepTime: number | undefined;
  let cookTime: number | undefined;

  lines.forEach((line, index) => {
    const heading = parseHeading(line);
    if (heading) {
      currentSection = heading;
      return;
    }

    if (!title && index === 0) {
      title = line;
      return;
    }

    servings = servings ?? parseServings(line);
    prepTime = prepTime ?? parseMinutes(line, "prep");
    cookTime = cookTime ?? parseMinutes(line, "cook");

    if (!currentSection) {
      return;
    }

    if (currentSection === "ingredients") {
      ingredients.push(line.replace(/^[-*]\s*/, ""));
    }

    if (currentSection === "instructions") {
      instructions.push(line.replace(/^\d+[\).]?\s*/, ""));
    }

    if (currentSection === "notes") {
      notes.push(line.replace(/^[-*]\s*/, ""));
    }
  });

  const cleanedIngredients = cleanIngredientLines(ingredients);
  const cleanedInstructions = cleanInstructionLines(instructions);
  const cleanedNotes = cleanTextLines(notes);

  return {
    title,
    ingredients: cleanedIngredients.lines,
    instructions: cleanedInstructions.lines,
    notes: Array.from(new Set([...cleanedIngredients.notes, ...cleanedInstructions.notes, ...cleanedNotes])),
    servings,
    prepTime,
    cookTime,
  };
}

export function buildOcrRecipePayload(text: string) {
  const parsed = parseOcrText(text);
  const instructionPrepGroups = buildPrepGroupsFromInstructions(parsed.ingredients, parsed.instructions);
  const prepGroups = instructionPrepGroups.length > 0 ? instructionPrepGroups : buildPrepGroups(parsed.ingredients);

  return {
    title: parsed.title ?? "Untitled Recipe",
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    notes: parsed.notes,
    servings: parsed.servings ?? null,
    prepTime: parsed.prepTime ?? null,
    cookTime: parsed.cookTime ?? null,
    prepGroups,
  };
}
