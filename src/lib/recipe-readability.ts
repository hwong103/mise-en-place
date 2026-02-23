import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

type ReadabilityRecipeDraft = {
  title?: string;
  description?: string;
  imageUrl?: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
};

const normalizeLine = (line: string) => line.replace(/\s+/g, " ").trim();

const normalizeListLine = (line: string) =>
  normalizeLine(
    line
      .replace(/^[-*•]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .replace(/[•·]/g, " ")
  );

const isIngredientHeading = (value: string) =>
  /^(ingredients?|for\s+the\s+.+|sauce|dressing|marinade|filling|topping)$/i.test(value);

const isInstructionHeading = (value: string) =>
  /^(instructions?|directions?|method|preparation|steps?)$/i.test(value);

const isNoteHeading = (value: string) => /^(notes?|tips?|cook'?s\s+notes?)$/i.test(value);

const likelyIngredient = (value: string) =>
  /\b\d+(?:\/\d+)?\b/.test(value) || /\b(cup|cups|tbsp|tsp|g|kg|oz|lb|ml|l)\b/i.test(value);

const likelyInstruction = (value: string) =>
  /^\d+[.)]\s+/.test(value) ||
  /\b(mix|stir|bake|cook|heat|whisk|combine|add|serve|preheat|simmer|fold|saute)\b/i.test(value);

export const extractRecipeFromReadability = (
  html: string,
  sourceUrl: string
): ReadabilityRecipeDraft | null => {
  const dom = new JSDOM(html, { url: sourceUrl });
  const parsed = new Readability(dom.window.document).parse();
  if (!parsed) {
    return null;
  }

  const textContent = parsed.textContent ?? "";
  const contentHtml = parsed.content ?? "";

  const lines = textContent
    .split(/\r?\n+/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const ingredients: string[] = [];
  const instructions: string[] = [];
  const notes: string[] = [];

  let section: "none" | "ingredients" | "instructions" | "notes" = "none";

  for (const line of lines) {
    if (isIngredientHeading(line)) {
      section = "ingredients";
      continue;
    }

    if (isInstructionHeading(line)) {
      section = "instructions";
      continue;
    }

    if (isNoteHeading(line)) {
      section = "notes";
      continue;
    }

    const cleaned = normalizeListLine(line);
    if (!cleaned) {
      continue;
    }

    if (section === "ingredients") {
      ingredients.push(cleaned);
      continue;
    }

    if (section === "instructions") {
      instructions.push(cleaned);
      continue;
    }

    if (section === "notes") {
      notes.push(cleaned);
      continue;
    }

    if (likelyIngredient(cleaned) && ingredients.length < 30) {
      ingredients.push(cleaned);
      continue;
    }

    if (likelyInstruction(cleaned) && instructions.length < 30) {
      instructions.push(cleaned);
    }
  }

  const imageMatch = contentHtml.match(/<img[^>]+src=["']([^"']+)["']/i);

  return {
    title: parsed.title ?? undefined,
    description: parsed.excerpt ?? undefined,
    imageUrl: imageMatch?.[1],
    ingredients: Array.from(new Set(ingredients)),
    instructions: Array.from(new Set(instructions)),
    notes: Array.from(new Set(notes)),
  };
};
