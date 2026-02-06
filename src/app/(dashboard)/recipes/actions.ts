"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getDefaultHouseholdId } from "@/lib/household";
import { fromDateKey } from "@/lib/date";
import {
  buildPrepGroups,
  buildPrepGroupsFromInstructions,
  cleanIngredientLines,
  cleanInstructionLines,
  cleanTextLines,
  coerceStringArray,
  parseLines,
  parsePrepGroupsFromText,
  parseTags,
} from "@/lib/recipe-utils";
import { buildOcrRecipePayload } from "@/lib/ocr";

const toOptionalInt = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
};

const toOptionalString = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalUrl = (value: FormDataEntryValue | null) => {
  const raw = toOptionalString(value);
  if (!raw) {
    return undefined;
  }

  try {
    new URL(raw);
    return raw;
  } catch {
    return undefined;
  }
};

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const normalizeText = (value: string) => decodeHtml(value).replace(/\s+/g, " ").trim();

const extractMeta = (html: string, key: string, attribute: "name" | "property") => {
  const regex = new RegExp(
    `<meta[^>]+${attribute}=[\"']${key}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`,
    "i"
  );
  const match = html.match(regex);
  return match ? decodeHtml(match[1].trim()) : undefined;
};

const extractTitle = (html: string) => {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeHtml(match[1].trim()) : undefined;
};

const asArray = <T,>(value: T | T[] | null | undefined) => {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const isRecipeType = (value: unknown) => {
  if (typeof value === "string") {
    return value.toLowerCase() === "recipe";
  }
  if (Array.isArray(value)) {
    return value.some((entry) => typeof entry === "string" && entry.toLowerCase() === "recipe");
  }
  return false;
};

const collectRecipeNodes = (node: unknown, results: Record<string, unknown>[]) => {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((entry) => collectRecipeNodes(entry, results));
    return;
  }

  if (typeof node !== "object") {
    return;
  }

  const record = node as Record<string, unknown>;
  if (isRecipeType(record["@type"])) {
    results.push(record);
  }

  if (record["@graph"]) {
    collectRecipeNodes(record["@graph"], results);
  }

  for (const value of Object.values(record)) {
    if (typeof value === "object") {
      collectRecipeNodes(value, results);
    }
  }
};

const parseJsonLdBlocks = (html: string) => {
  const blocks: unknown[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = regex.exec(html);
  while (match) {
    const raw = match[1]?.trim();
    if (raw) {
      try {
        blocks.push(JSON.parse(raw));
      } catch {
        // ignore malformed JSON-LD
      }
    }
    match = regex.exec(html);
  }
  return blocks;
};

const extractTextList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return decodeHtml(value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractTextList(entry));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") {
      return extractTextList(record.text);
    }
    if (record.itemListElement) {
      return extractTextList(record.itemListElement);
    }
    if (record.steps) {
      return extractTextList(record.steps);
    }
  }

  return [];
};

const extractImageUrl = (value: unknown) => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return extractImageUrl(value[0]);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") {
      return record.url;
    }
  }
  return undefined;
};

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

const extractNotesFromDescription = (value: string | undefined) => {
  if (!value) {
    return { description: undefined, notes: [] as string[] };
  }

  const sentences = value.split(/(?<=[.!?])\s+/g).map((sentence) => sentence.trim());
  const notes: string[] = [];
  const kept: string[] = [];

  for (const sentence of sentences) {
    if (!sentence) {
      continue;
    }

    if (/\bsee\s+note\s*\d+/i.test(sentence) || /^note\s*\d+/i.test(sentence)) {
      notes.push(sentence);
      continue;
    }

    kept.push(sentence);
  }

  const description = kept.join(" ").trim();
  return {
    description: description.length > 0 ? description : undefined,
    notes,
  };
};

const parseYield = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      return Number(match[0]);
    }
  }
  return undefined;
};

const parseDurationMinutes = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) {
    return undefined;
  }
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
};

const extractNotesFromHtml = (html: string) => {
  const sections: string[] = [];
  const classRegex =
    /<(div|section)[^>]+(?:class|id)=["'][^"']*(wprm-recipe-notes|recipe[-_ ]?notes)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match = classRegex.exec(html);
  while (match) {
    sections.push(match[3]);
    match = classRegex.exec(html);
  }

  if (sections.length === 0) {
    const headingRegex =
      /<h[2-4][^>]*>\s*Recipe Notes[:\s]*<\/h[2-4]>([\s\S]*?)(<h[2-4][^>]*>|$)/i;
    const headingMatch = html.match(headingRegex);
    if (headingMatch?.[1]) {
      sections.push(headingMatch[1]);
    }
  }

  if (sections.length === 0) {
    return [];
  }

  const lines = sections.flatMap((section) => {
    const text = section
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|tr|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "");
    return decodeHtml(text)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  });

  return lines.filter((line) => !/^nutrition\b/i.test(line));
};

const extractRecipeFromHtml = (html: string) => {
  const blocks = parseJsonLdBlocks(html);
  const recipeNodes: Record<string, unknown>[] = [];
  blocks.forEach((block) => collectRecipeNodes(block, recipeNodes));

  const recipe = recipeNodes.find(
    (node) =>
      node.recipeIngredient ||
      node.ingredients ||
      node.recipeInstructions ||
      node.name ||
      node.headline
  );

  if (!recipe) {
    return null;
  }

  const title =
    (typeof recipe.name === "string" && normalizeText(recipe.name)) ||
    (typeof recipe.headline === "string" && normalizeText(recipe.headline)) ||
    undefined;
  const description =
    (typeof recipe.description === "string" && normalizeText(recipe.description)) || undefined;
  const imageUrl = extractImageUrl(recipe.image);
  const ingredients = extractTextList(recipe.recipeIngredient ?? recipe.ingredients);
  const instructions = extractTextList(recipe.recipeInstructions);
  const tags = typeof recipe.keywords === "string"
    ? parseTags(normalizeText(recipe.keywords))
    : extractTextList(recipe.keywords);
  const servings = parseYield(recipe.recipeYield);
  const prepTime = parseDurationMinutes(recipe.prepTime);
  const cookTime = parseDurationMinutes(recipe.cookTime);

  return {
    title,
    description,
    imageUrl,
    ingredients,
    instructions,
    tags,
    servings,
    prepTime,
    cookTime,
  };
};

const buildRecipePayload = (formData: FormData) => {
  const title = toOptionalString(formData.get("title"));
  if (!title) {
    return null;
  }

  const description = toOptionalString(formData.get("description"));
  const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
  const imageUrl = toOptionalUrl(formData.get("imageUrl"));
  const servings = toOptionalInt(formData.get("servings"));
  const prepTime = toOptionalInt(formData.get("prepTime"));
  const cookTime = toOptionalInt(formData.get("cookTime"));
  const tags = parseTags(formData.get("tags")?.toString() ?? "");
  const ingredients = parseLines(formData.get("ingredients")?.toString() ?? "");
  const instructions = parseLines(formData.get("instructions")?.toString() ?? "");
  const notes = parseLines(formData.get("notes")?.toString() ?? "");
  const instructionPrepGroups = buildPrepGroupsFromInstructions(ingredients, instructions);
  const prepGroups =
    instructionPrepGroups.length > 0 ? instructionPrepGroups : buildPrepGroups(ingredients);

  return {
    title,
    description,
    sourceUrl,
    imageUrl,
    servings,
    prepTime,
    cookTime,
    tags,
    ingredients,
    instructions,
    notes,
    prepGroups,
  };
};

export async function createRecipe(formData: FormData) {
  const payload = buildRecipePayload(formData);
  if (!payload) {
    return;
  }

  const householdId = await getDefaultHouseholdId();

  await prisma.recipe.create({
    data: {
      householdId,
      ...payload,
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/planner");
  redirect("/recipes");
}

export async function createRecipeFromOcr(formData: FormData) {
  const ocrText = toOptionalString(formData.get("ocrText"));
  if (!ocrText) {
    return;
  }

  const title = toOptionalString(formData.get("title"));
  const payload = buildOcrRecipePayload(ocrText);

  const householdId = await getDefaultHouseholdId();

  const recipe = await prisma.recipe.create({
    data: {
      householdId,
      title: title ?? payload.title,
      description: null,
      imageUrl: null,
      sourceUrl: null,
      servings: payload.servings,
      prepTime: payload.prepTime,
      cookTime: payload.cookTime,
      tags: [],
      ingredients: payload.ingredients,
      instructions: payload.instructions,
      notes: payload.notes,
      prepGroups: payload.prepGroups,
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/planner");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(formData: FormData) {
  const recipeId = toOptionalString(formData.get("recipeId"));
  if (!recipeId) {
    return;
  }

  const payload = buildRecipePayload(formData);
  if (!payload) {
    return;
  }

  const householdId = await getDefaultHouseholdId();

  await prisma.recipe.updateMany({
    where: { id: recipeId, householdId },
    data: payload,
  });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/planner");
  revalidatePath("/shopping");
  redirect(`/recipes/${recipeId}`);
}

export async function updateRecipeSection(formData: FormData) {
  const recipeId = toOptionalString(formData.get("recipeId"));
  const section = toOptionalString(formData.get("section"));
  if (!recipeId || !section) {
    return;
  }

  const householdId = await getDefaultHouseholdId();
  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, householdId },
  });

  if (!recipe) {
    return;
  }

  const existingNotes = coerceStringArray(recipe.notes);
  const existingIngredients = coerceStringArray(recipe.ingredients);
  const existingInstructions = coerceStringArray(recipe.instructions);

  if (section === "ingredients") {
    const raw = parseLines(formData.get("ingredients")?.toString() ?? "");
    const cleanedIngredients = cleanIngredientLines(raw);
    const cleanedInstructions = cleanInstructionLines(existingInstructions);
    const instructionPrepGroups = buildPrepGroupsFromInstructions(
      cleanedIngredients.lines,
      cleanedInstructions.lines
    );

    await prisma.recipe.updateMany({
      where: { id: recipeId, householdId },
      data: {
        ingredients: cleanedIngredients.lines,
        notes: existingNotes.length > 0 ? existingNotes : cleanedIngredients.notes,
        prepGroups:
          instructionPrepGroups.length > 0
            ? instructionPrepGroups
            : buildPrepGroups(cleanedIngredients.lines),
      },
    });
  }

  if (section === "instructions") {
    const raw = parseLines(formData.get("instructions")?.toString() ?? "");
    const cleanedInstructions = cleanInstructionLines(raw);
    const cleanedIngredients = cleanIngredientLines(existingIngredients);
    const instructionPrepGroups = buildPrepGroupsFromInstructions(
      cleanedIngredients.lines,
      cleanedInstructions.lines
    );

    await prisma.recipe.updateMany({
      where: { id: recipeId, householdId },
      data: {
        instructions: cleanedInstructions.lines,
        notes: existingNotes.length > 0 ? existingNotes : cleanedInstructions.notes,
        prepGroups:
          instructionPrepGroups.length > 0
            ? instructionPrepGroups
            : buildPrepGroups(cleanedIngredients.lines),
      },
    });
  }

  if (section === "notes") {
    const raw = parseLines(formData.get("notes")?.toString() ?? "");
    const cleanedNotes = cleanTextLines(raw);
    await prisma.recipe.updateMany({
      where: { id: recipeId, householdId },
      data: {
        notes: cleanedNotes,
      },
    });
  }

  if (section === "prepGroups") {
    const raw = formData.get("prepGroups")?.toString() ?? "";
    const prepGroups = parsePrepGroupsFromText(raw);
    await prisma.recipe.updateMany({
      where: { id: recipeId, householdId },
      data: {
        prepGroups,
      },
    });
  }

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function importRecipeFromUrl(formData: FormData) {
  const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
  if (!sourceUrl) {
    return;
  }

  let html = "";

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "MiseEnPlaceBot/1.0",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return;
    }
    html = await response.text();
  } catch {
    return;
  }

  const title =
    extractMeta(html, "og:title", "property") ||
    extractMeta(html, "twitter:title", "name") ||
    extractTitle(html) ||
    new URL(sourceUrl).hostname;
  const scrapedRecipe = extractRecipeFromHtml(html);
  const cleanedIngredients = cleanIngredientLines(scrapedRecipe?.ingredients ?? []);
  const cleanedInstructions = cleanInstructionLines(scrapedRecipe?.instructions ?? []);
  const htmlNotes = extractNotesFromHtml(html);
  const instructionPrepGroups = buildPrepGroupsFromInstructions(
    cleanedIngredients.lines,
    cleanedInstructions.lines
  );
  const prepGroups =
    instructionPrepGroups.length > 0
      ? instructionPrepGroups
      : buildPrepGroups(cleanedIngredients.lines);
  const rawDescription =
    scrapedRecipe?.description ||
    extractMeta(html, "description", "name") ||
    extractMeta(html, "og:description", "property") ||
    extractMeta(html, "twitter:description", "name");
  const descriptionCandidate = cleanDescription(rawDescription);
  const { description, notes: descriptionNotes } = extractNotesFromDescription(
    descriptionCandidate
  );
  const imageUrl = toOptionalUrl(
    scrapedRecipe?.imageUrl ??
    extractMeta(html, "og:image", "property") ??
    extractMeta(html, "twitter:image", "name") ??
    null
  );
  const notes = Array.from(
    new Set([
      ...cleanedIngredients.notes,
      ...cleanedInstructions.notes,
      ...htmlNotes,
      ...descriptionNotes,
    ])
  ).filter((note) => !/^note\s*\d+$/i.test(note));

  const householdId = await getDefaultHouseholdId();

  const recipe = await prisma.recipe.create({
    data: {
      householdId,
      title: scrapedRecipe?.title || title,
      description,
      sourceUrl,
      imageUrl,
      servings: scrapedRecipe?.servings ?? null,
      prepTime: scrapedRecipe?.prepTime ?? null,
      cookTime: scrapedRecipe?.cookTime ?? null,
      tags: scrapedRecipe?.tags ?? [],
      ingredients: cleanedIngredients.lines,
      instructions: cleanedInstructions.lines,
      notes,
      prepGroups,
    },
  });

  revalidatePath("/recipes");
  revalidatePath("/planner");
  redirect(`/recipes/${recipe.id}`);
}

export async function deleteRecipe(formData: FormData) {
  const recipeId = toOptionalString(formData.get("recipeId"));
  if (!recipeId) {
    return;
  }

  const householdId = await getDefaultHouseholdId();

  await prisma.mealPlan.deleteMany({
    where: { recipeId, householdId },
  });

  await prisma.recipe.deleteMany({
    where: { id: recipeId, householdId },
  });

  revalidatePath("/recipes");
  revalidatePath("/planner");
  revalidatePath("/shopping");
  redirect("/recipes");
}

export async function addToMealPlan(formData: FormData) {
  const recipeId = toOptionalString(formData.get("recipeId"));
  const dateKey = toOptionalString(formData.get("date"));
  const mealType = toOptionalString(formData.get("mealType"));

  if (!recipeId || !dateKey || !mealType) {
    return;
  }

  const normalizedMealType = mealType as "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  const householdId = await getDefaultHouseholdId();
  const date = fromDateKey(dateKey);

  await prisma.mealPlan.upsert({
    where: {
      householdId_date_mealType: {
        householdId,
        date,
        mealType: normalizedMealType,
      },
    },
    update: {
      recipeId,
    },
    create: {
      householdId,
      recipeId,
      date,
      mealType: normalizedMealType,
      servings: 2,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
  redirect("/planner");
}
