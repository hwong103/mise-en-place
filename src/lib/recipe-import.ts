import { parseTags } from "@/lib/recipe-utils";

export type MarkdownRecipeDraft = {
  title?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
  tags: string[];
};

const normalizeText = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanDescription = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const cleaned = normalizeText(value)
    .replace(/\brecipe video above\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned.length > 0 ? cleaned : undefined;
};

const markdownHeading = (value: string) =>
  normalizeText(value.replace(/^#{1,6}\s+/, "").replace(/[:#\s]+$/, ""));

const markdownToLine = (value: string) =>
  normalizeText(
    value
      .replace(/^>\s*/, "")
      .replace(/^\s*[-*+]\s+/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_~]+/g, "")
  );

const isIngredientHeading = (value: string) =>
  /(^|\b)(ingredients?|for\s+the\s+.+|for\s+serving|to\s+serve|sauce|dressing|marinade|filling|topping)(\b|$)/i.test(
    value
  );

const isInstructionHeading = (value: string) =>
  /^(instructions?|directions?|method|preparation|steps?)$/i.test(value);

const isNoteHeading = (value: string) => /^(notes?|tips?|cook'?s?\s+notes?)$/i.test(value);

export const parseMarkdownRecipe = (markdown: string, fallbackTitle?: string): MarkdownRecipeDraft => {
  const stripped = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
  const lines = stripped.split(/\r?\n/);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  const notes: string[] = [];
  const descriptionLines: string[] = [];
  const tags: string[] = [];
  let title = fallbackTitle;
  let section: "none" | "ingredients" | "instructions" | "notes" = "none";
  let reachedRecipeSection = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const headingCandidate =
      /^#{1,6}\s+/.test(trimmed) || /^[A-Za-z][A-Za-z\s'/-]{2,40}:?$/.test(trimmed)
        ? markdownHeading(trimmed)
        : "";

    if (headingCandidate) {
      if (
        !title &&
        !isIngredientHeading(headingCandidate) &&
        !isInstructionHeading(headingCandidate) &&
        !isNoteHeading(headingCandidate)
      ) {
        title = headingCandidate;
        continue;
      }

      if (isIngredientHeading(headingCandidate)) {
        section = "ingredients";
        reachedRecipeSection = true;
        continue;
      }
      if (isInstructionHeading(headingCandidate)) {
        section = "instructions";
        reachedRecipeSection = true;
        continue;
      }
      if (isNoteHeading(headingCandidate)) {
        section = "notes";
        reachedRecipeSection = true;
        continue;
      }

      // Keep the active section for subsection headings like "Sauce" or "Serving".
      if (reachedRecipeSection && section !== "none") {
        continue;
      }

      section = "none";
      continue;
    }

    const normalized = markdownToLine(trimmed);
    if (!normalized) {
      continue;
    }

    if (!reachedRecipeSection && descriptionLines.length < 3) {
      descriptionLines.push(normalized);
    }

    if (/^tags?:\s*/i.test(normalized)) {
      tags.push(...parseTags(normalized.replace(/^tags?:\s*/i, "")));
      continue;
    }

    if (section === "ingredients") {
      ingredients.push(normalized);
      continue;
    }

    if (section === "instructions") {
      instructions.push(normalized);
      continue;
    }

    if (section === "notes") {
      notes.push(normalized);
    }
  }

  return {
    title,
    description: cleanDescription(descriptionLines.join(" ")),
    ingredients,
    instructions,
    notes,
    tags: Array.from(new Set(tags)),
  };
};
