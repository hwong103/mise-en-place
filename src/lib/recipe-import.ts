import { parseTags } from "@/lib/recipe-utils";

export type MarkdownRecipeDraft = {
  title?: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
  tags: string[];
};

type MarkdownFrontmatter = {
  body: string;
  title?: string;
  description?: string;
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

const parseMarkdownFrontmatter = (markdown: string): MarkdownFrontmatter => {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) {
    return { body: markdown };
  }

  let title: string | undefined;
  let description: string | undefined;

  for (const line of match[1].split(/\r?\n/)) {
    const frontmatterEntry = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!frontmatterEntry) {
      continue;
    }

    const key = frontmatterEntry[1].toLowerCase();
    const value = normalizeText(frontmatterEntry[2]);
    if (!value) {
      continue;
    }

    if (key === "title") {
      title = value;
    }

    if (key === "description") {
      description = value;
    }
  }

  return {
    body: markdown.slice(match[0].length),
    title,
    description,
  };
};

const markdownHeading = (value: string) =>
  normalizeText(value.replace(/^#{1,6}\s+/, "").replace(/[:#\s]+$/, ""));

const markdownHeadingLevel = (value: string) => {
  const match = value.match(/^(#{1,6})\s+/);
  return match ? match[1].length : null;
};

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
  /^(ingredients?|for\s+the\s+.+|for\s+serving|to\s+serve|serving|sauce|dressing|marinade|filling|topping|garnish)$/i.test(
    value
  );

const isInstructionHeading = (value: string) =>
  /^(instructions?|directions?|method|preparation|steps?)$/i.test(value);

const isNoteHeading = (value: string) =>
  /^(recipe\s+)?(notes?|tips?|cook'?s?\s+notes?)$/i.test(value);

export const parseMarkdownRecipe = (markdown: string, fallbackTitle?: string): MarkdownRecipeDraft => {
  const frontmatter = parseMarkdownFrontmatter(markdown);
  const lines = frontmatter.body.split(/\r?\n/);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  const notes: string[] = [];
  const descriptionLines: string[] = [];
  const tags: string[] = [];
  let title = fallbackTitle ?? frontmatter.title;
  let section: "none" | "ingredients" | "instructions" | "notes" = "none";
  let sectionHeadingLevel: number | null = null;
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
      const headingLevel = markdownHeadingLevel(trimmed);

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
        sectionHeadingLevel = headingLevel ?? 2;
        reachedRecipeSection = true;
        continue;
      }
      if (isInstructionHeading(headingCandidate)) {
        section = "instructions";
        sectionHeadingLevel = headingLevel ?? 2;
        reachedRecipeSection = true;
        continue;
      }
      if (isNoteHeading(headingCandidate)) {
        section = "notes";
        sectionHeadingLevel = headingLevel ?? 2;
        reachedRecipeSection = true;
        continue;
      }

      // Keep the active section only for lower-level subsection headings.
      if (
        reachedRecipeSection &&
        section !== "none" &&
        headingLevel !== null &&
        sectionHeadingLevel !== null &&
        headingLevel > sectionHeadingLevel
      ) {
        continue;
      }

      section = "none";
      sectionHeadingLevel = null;
      continue;
    }

    const normalized = markdownToLine(trimmed);
    if (!normalized) {
      continue;
    }

    if (!reachedRecipeSection && !frontmatter.description && descriptionLines.length < 3) {
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
    description: cleanDescription(frontmatter.description ?? descriptionLines.join(" ")),
    ingredients,
    instructions,
    notes,
    tags: Array.from(new Set(tags)),
  };
};
