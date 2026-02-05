import { buildPrepGroups, buildPrepGroupsFromInstructions, cleanIngredientLines, cleanInstructionLines, cleanTextLines } from "@/lib/recipe-utils";

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

export function parseOcrText(text: string): ParsedOcrRecipe {
  const lines = splitLines(text);
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
