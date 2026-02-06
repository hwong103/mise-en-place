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

const normalizeUrlCandidate = (value: string) =>
  decodeHtml(value)
    .trim()
    .replace(/^[("'`\\[]+/, "")
    .replace(/[)"'`\\]>.,;]+$/, "");

const getVideoKind = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be" || hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com")) {
      return "youtube";
    }
    if (hostname === "vimeo.com" || hostname === "player.vimeo.com" || hostname.endsWith(".vimeo.com")) {
      return "vimeo";
    }
  } catch {
    return null;
  }

  return null;
};

const normalizeSourceUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }
    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return undefined;
  }
};

const buildSourceUrlCandidates = (value: string | undefined) => {
  if (!value) {
    return [];
  }

  const normalized = normalizeSourceUrl(value);
  const candidates = new Set<string>();

  if (normalized) {
    candidates.add(normalized);
    candidates.add(`${normalized}/`);
    candidates.add(`${normalized}?`);
    candidates.add(`${normalized}#`);
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const altHosts = new Set([host, `www.${host}`]);
    const protocols = new Set([url.protocol, url.protocol === "http:" ? "https:" : "http:"]);

    for (const protocol of protocols) {
      for (const hostname of altHosts) {
        const base = `${protocol}//${hostname}${url.pathname.replace(/\/+$/, "")}`;
        candidates.add(base);
        candidates.add(`${base}/`);
        candidates.add(`${base}?`);
        candidates.add(`${base}#`);
      }
    }
  } catch {
    candidates.add(value);
  }

  candidates.add(value);
  return Array.from(candidates);
};

const toOptionalUrlString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = normalizeUrlCandidate(value);
  if (!normalized) {
    return undefined;
  }
  try {
    new URL(normalized);
    return normalized;
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

const extractVideoUrl = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    return toOptionalUrlString(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = extractVideoUrl(entry);
      if (found) {
        return found;
      }
    }
    return undefined;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractVideoUrl(
      record.embedUrl ?? record.contentUrl ?? record.url ?? record["@id"]
    );
  }
  return undefined;
};

const extractVideoFromHtml = (html: string) => {
  const metaCandidate =
    extractMeta(html, "og:video:secure_url", "property") ||
    extractMeta(html, "og:video:url", "property") ||
    extractMeta(html, "og:video", "property") ||
    extractMeta(html, "twitter:player", "name");
  const candidates: string[] = [];
  const metaUrl = toOptionalUrlString(metaCandidate ?? "");
  if (metaUrl) {
    candidates.push(metaUrl);
  }

  const iframeAttrRegex =
    /<(?:iframe|video)[^>]+(?:data-cmp-src|data-src|data-lazy-src|data-yt-src|src)=["']([^"']+)["'][^>]*>/gi;
  let iframeMatch = iframeAttrRegex.exec(html);
  while (iframeMatch) {
    const raw = iframeMatch[1];
    if (/youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com/i.test(raw)) {
      const iframeUrl = toOptionalUrlString(raw);
      if (iframeUrl) {
        candidates.push(iframeUrl);
      }
    }
    iframeMatch = iframeAttrRegex.exec(html);
  }

  const linkMatch = html.match(
    /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube-nocookie\.com\/embed\/|vimeo\.com\/)\S+)/i
  );
  if (linkMatch?.[1]) {
    const linkUrl = toOptionalUrlString(linkMatch[1]);
    if (linkUrl) {
      candidates.push(linkUrl);
    }
  }

  const normalizedCandidates = candidates
    .map((candidate) => normalizeVideoUrl(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  const youtubeCandidate = normalizedCandidates.find(
    (candidate) => getVideoKind(candidate) === "youtube"
  );
  if (youtubeCandidate) {
    return youtubeCandidate;
  }

  const vimeoCandidate = normalizedCandidates.find(
    (candidate) => getVideoKind(candidate) === "vimeo"
  );
  return vimeoCandidate;
};

const normalizeVideoUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://youtu.be/${id}` : value;
    }

    if (hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://youtu.be/${id}` : value;
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://youtu.be/${id}` : value;
      }
    }

    if (hostname === "vimeo.com" || hostname === "player.vimeo.com" || hostname.endsWith(".vimeo.com")) {
      const idMatch = url.pathname.match(/(\d+)/);
      const id = idMatch ? idMatch[1] : null;
      return id ? `https://vimeo.com/${id}` : value;
    }
  } catch {
    return undefined;
  }

  return value;
};

const findRecipeBySourceUrl = async (
  householdId: string,
  sourceUrl: string | undefined
) => {
  if (!sourceUrl) {
    return null;
  }

  const normalized = normalizeSourceUrl(sourceUrl);
  const candidates = buildSourceUrlCandidates(sourceUrl);
  if (!normalized || candidates.length === 0) {
    return null;
  }

  const matches = await prisma.recipe.findMany({
    where: {
      householdId,
      OR: candidates.map((candidate) => ({
        sourceUrl: {
          startsWith: candidate,
        },
      })),
    },
    select: { id: true, sourceUrl: true },
  });
  return (
    matches.find(
      (match) => normalizeSourceUrl(match.sourceUrl ?? "") === normalized
    ) ?? null
  );
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
  const videoUrl = extractVideoUrl(recipe.video ?? recipe.videoUrl);

  return {
    title,
    description,
    imageUrl,
    videoUrl,
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
  const videoUrl = toOptionalUrl(formData.get("videoUrl"));
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
    sourceUrl: normalizeSourceUrl(sourceUrl) ?? sourceUrl,
    imageUrl,
    videoUrl,
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

  const householdId = await getDefaultHouseholdId();
  const existingRecipe = await findRecipeBySourceUrl(householdId, sourceUrl);

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
    if (existingRecipe) {
      redirect(`/recipes/${existingRecipe.id}`);
    }
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
  const rawVideoUrl = scrapedRecipe?.videoUrl ?? extractVideoFromHtml(html);
  const normalizedVideoUrl = normalizeVideoUrl(rawVideoUrl);
  const videoUrl =
    getVideoKind(normalizedVideoUrl) === "youtube"
      ? normalizedVideoUrl
      : normalizedVideoUrl ?? undefined;
  const notes = Array.from(
    new Set([
      ...cleanedIngredients.notes,
      ...cleanedInstructions.notes,
      ...htmlNotes,
      ...descriptionNotes,
    ])
  ).filter((note) => !/^note\s*\d+$/i.test(note));

  const normalizedSourceUrl = normalizeSourceUrl(sourceUrl) ?? sourceUrl;

  if (existingRecipe) {
    const existing = await prisma.recipe.findFirst({
      where: { id: existingRecipe.id, householdId },
      select: { id: true, videoUrl: true },
    });

    if (existing) {
      const existingKind = getVideoKind(existing.videoUrl ?? undefined);
      const nextKind = getVideoKind(videoUrl ?? undefined);
      const shouldUpdate =
        (!existing.videoUrl && videoUrl) ||
        (existingKind !== "youtube" && nextKind === "youtube") ||
        (existingKind === null && nextKind !== null);

      if (shouldUpdate && videoUrl) {
        await prisma.recipe.update({
          where: { id: existing.id },
          data: { videoUrl },
        });
      }
    }

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${existingRecipe.id}`);
    redirect(`/recipes/${existingRecipe.id}`);
  }

  const recipe = await prisma.recipe.create({
    data: {
      householdId,
      title: scrapedRecipe?.title || title,
      description,
      sourceUrl: normalizedSourceUrl,
      imageUrl,
      videoUrl,
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
