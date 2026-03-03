import { cleanIngredientLines, cleanInstructionLines, cleanTextLines } from "@/lib/recipe-utils";
import type { RecipeIngestionCandidate } from "@/lib/recipe-ingestion-types";
import type { GroqVisionRecipe } from "@/lib/ocr";

type CaptionParseState = "none" | "ingredients" | "instructions" | "notes";

type BuildInstagramCandidateInput = {
  sourceUrl: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  markdown?: string;
  assistedCaption?: string;
  assistedRecipes?: GroqVisionRecipe[];
  latencyMs: number;
};

const INSTAGRAM_VERB_PATTERN = /\b(add|mix|stir|bake|cook|heat|simmer|boil|whisk|combine|serve|pour|fold|season|rest|chill|grill|roast)\b/i;
const INSTAGRAM_INGREDIENT_PATTERN = /^((\d+|\d+\/\d+|\d+\.\d+|\d+\s+\d+\/\d+|a|an)\s+)?(cup|cups|tbsp|tsp|teaspoon|teaspoons|tablespoon|tablespoons|g|kg|ml|l|oz|lb|lbs|clove|cloves|pinch|dash|can|cans|slice|slices)\b/i;
const INSTAGRAM_NOISE_PATTERN = /^(view\s+more|follow\s+for\s+more|link\s+in\s+bio|reels?\b|posted\s+by\b|original\s+audio\b)/i;
const INSTAGRAM_URL_ONLY_PATTERN = /^https?:\/\//i;

const normalizeLine = (line: string) =>
  line
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^\s*[-*]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const parseMarkdownBody = (markdown: string) => {
  const frontmatter = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!frontmatter) {
    return markdown;
  }
  return markdown.slice(frontmatter[0].length);
};

const parseHeading = (line: string): CaptionParseState | null => {
  const normalized = line.toLowerCase().replace(/^#{1,6}\s+/, "").replace(/[:\s]+$/, "").trim();
  if (/^ingredients?$/.test(normalized)) {
    return "ingredients";
  }
  if (/^(instructions?|directions?|method|steps?)$/.test(normalized)) {
    return "instructions";
  }
  if (/^(notes?|tips?)$/.test(normalized)) {
    return "notes";
  }
  return null;
};

const isIngredientLine = (line: string) => {
  if (INSTAGRAM_INGREDIENT_PATTERN.test(line)) {
    return true;
  }
  if (/^(\d+|\d+\/\d+|\d+\.\d+)\s+/.test(line)) {
    return true;
  }
  return /^[-*]/.test(line);
};

const isInstructionLine = (line: string) => {
  if (/^\d+[.)]/.test(line)) {
    return true;
  }
  return INSTAGRAM_VERB_PATTERN.test(line) && line.split(" ").length >= 4;
};

const dedupe = (lines: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  lines.forEach((line) => {
    const key = line.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(line);
  });
  return result;
};

export const extractInstagramCaptionCandidate = (markdown: string | undefined, assistedCaption?: string) => {
  const assisted = assistedCaption?.trim();
  if (assisted) {
    return assisted;
  }

  if (!markdown) {
    return undefined;
  }

  const body = parseMarkdownBody(markdown);
  const lines = body
    .split(/\r?\n/)
    .map((raw) => normalizeLine(raw))
    .filter((line) => line.length > 0)
    .filter((line) => !INSTAGRAM_URL_ONLY_PATTERN.test(line))
    .filter((line) => !INSTAGRAM_NOISE_PATTERN.test(line));

  if (lines.length === 0) {
    return undefined;
  }

  return lines.join("\n");
};

export const parseInstagramCaptionToLines = (caption: string) => {
  const ingredients: string[] = [];
  const instructions: string[] = [];
  const notes: string[] = [];
  let section: CaptionParseState = "none";

  caption.split(/\r?\n/).forEach((rawLine) => {
    const normalized = normalizeLine(rawLine);
    if (!normalized) {
      return;
    }

    const heading = parseHeading(rawLine);
    if (heading) {
      section = heading;
      return;
    }

    if (section === "ingredients") {
      ingredients.push(normalized);
      return;
    }
    if (section === "instructions") {
      instructions.push(normalized);
      return;
    }
    if (section === "notes") {
      notes.push(normalized);
      return;
    }

    if (isIngredientLine(rawLine)) {
      ingredients.push(normalized);
      return;
    }

    if (isInstructionLine(rawLine)) {
      instructions.push(normalized);
      return;
    }

    notes.push(normalized);
  });

  const cleanedIngredients = cleanIngredientLines(dedupe(ingredients));
  const cleanedInstructions = cleanInstructionLines(dedupe(instructions));
  const cleanedNotes = cleanTextLines(dedupe(notes));

  return {
    ingredients: cleanedIngredients.lines,
    instructions: cleanedInstructions.lines,
    notes: dedupe([...cleanedIngredients.notes, ...cleanedInstructions.notes, ...cleanedNotes]),
  };
};

export const mergeInstagramAssistedOcr = (
  captionLines: ReturnType<typeof parseInstagramCaptionToLines>,
  assistedRecipes: GroqVisionRecipe[]
) => {
  const mergedIngredients = dedupe([
    ...captionLines.ingredients,
    ...assistedRecipes.flatMap((recipe) => recipe.ingredients ?? []),
  ]);
  const mergedInstructions = dedupe([
    ...captionLines.instructions,
    ...assistedRecipes.flatMap((recipe) => recipe.instructions ?? []),
  ]);
  const mergedNotes = dedupe([
    ...captionLines.notes,
    ...assistedRecipes.flatMap((recipe) => recipe.notes ?? []),
  ]);

  return {
    title: assistedRecipes.find((recipe) => recipe.title?.trim())?.title?.trim(),
    description: assistedRecipes.find((recipe) => recipe.description?.trim())?.description?.trim(),
    ingredients: mergedIngredients,
    instructions: mergedInstructions,
    notes: mergedNotes,
    servings: assistedRecipes.find((recipe) => typeof recipe.servings === "number")?.servings,
    prepTime: assistedRecipes.find((recipe) => typeof recipe.prepTime === "number")?.prepTime,
    cookTime: assistedRecipes.find((recipe) => typeof recipe.cookTime === "number")?.cookTime,
  };
};

export const buildInstagramCandidate = ({
  sourceUrl,
  title,
  description,
  imageUrl,
  videoUrl,
  markdown,
  assistedCaption,
  assistedRecipes = [],
  latencyMs,
}: BuildInstagramCandidateInput): RecipeIngestionCandidate => {
  const caption = extractInstagramCaptionCandidate(markdown, assistedCaption);
  const captionLines = parseInstagramCaptionToLines(caption ?? "");
  const merged = mergeInstagramAssistedOcr(captionLines, assistedRecipes);
  const stage = assistedRecipes.length > 0 ? "instagram_assisted_ocr" : "instagram_caption";

  return {
    stage,
    success: Boolean(
      title ||
      description ||
      caption ||
      merged.title ||
      merged.ingredients.length > 0 ||
      merged.instructions.length > 0
    ),
    title: merged.title ?? title,
    description: merged.description ?? description,
    imageUrl,
    videoUrl,
    ingredients: merged.ingredients,
    instructions: merged.instructions,
    notes: merged.notes,
    servings: merged.servings,
    prepTime: merged.prepTime,
    cookTime: merged.cookTime,
    sourcePlatform: sourceUrl.includes("instagram.com") ? "instagram" : "web",
    latencyMs,
  };
};
