"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { logServerPerf } from "@/lib/server-perf";
import { fromDateKey } from "@/lib/date";
import { parseMarkdownRecipe } from "@/lib/recipe-import";
import {
  buildPrepGroups,
  buildPrepGroupsFromInstructions,
  cleanIngredientLine,
  cleanIngredientLines,
  cleanInstructionLines,
  cleanTextLines,
  coerceStringArray,
  parseLines,
  parsePrepGroupsFromText,
  parseTags,
  type PrepGroup,
} from "@/lib/recipe-utils";
import { buildOcrRecipePayload } from "@/lib/ocr";
import { fetchRenderedRecipeCandidate, isRenderFallbackEnabled } from "@/lib/recipe-render-worker-client";
import {
  HIGH_CONFIDENCE_INGESTION_SCORE,
  MIN_INGESTION_SCORE,
  classifyIngestionFailure,
  selectBestRecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-quality";
import { logRecipeIngestionDiagnostics } from "@/lib/recipe-ingestion-diagnostics";
import { applyRecipeSiteAdapters } from "@/lib/recipe-site-adapters";
import type {
  IngestionAttemptResult,
  IngestionErrorCode,
  RecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-types";

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

const stripHtml = (value: string) =>
  normalizeText(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|tr|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  );

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

const normalizeExtractedList = (value: string) =>
  decodeHtml(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const extractTextList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return normalizeExtractedList(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractTextList(entry));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string" && typeof record.text !== "string") {
      const sections = extractTextList(record.itemListElement ?? record.recipeInstructions ?? record.steps);
      if (sections.length > 0) {
        return sections;
      }
      return normalizeExtractedList(record.name);
    }
    if (typeof record.text === "string") {
      return extractTextList(record.text);
    }
    if (record.recipeInstructions) {
      return extractTextList(record.recipeInstructions);
    }
    if (record.recipeIngredient) {
      return extractTextList(record.recipeIngredient);
    }
    if (record.itemListElement) {
      return extractTextList(record.itemListElement);
    }
    if (record.steps) {
      return extractTextList(record.steps);
    }
    if (record["@type"] === "HowToSection" && record.itemListElement) {
      return extractTextList(record.itemListElement);
    }
  }

  return [];
};

const extractIngredientValue = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return normalizeExtractedList(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractIngredientValue(entry));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.name === "string" && typeof record.value === "string") {
      const quantity = normalizeText(record.value);
      const name = normalizeText(record.name);
      return quantity && name ? [`${quantity} ${name}`.trim()] : [];
    }
    if (typeof record.name === "string" && typeof record.unitText === "string") {
      const amount = typeof record.value === "string" ? normalizeText(record.value) : "";
      const combined = [amount, normalizeText(record.unitText), normalizeText(record.name)]
        .filter(Boolean)
        .join(" ");
      return combined ? [combined] : [];
    }
    if (record.recipeIngredient) {
      return extractIngredientValue(record.recipeIngredient);
    }
    if (record.ingredients) {
      return extractIngredientValue(record.ingredients);
    }
    if (record.itemListElement) {
      return extractIngredientValue(record.itemListElement);
    }
    if (typeof record.text === "string") {
      return extractIngredientValue(record.text);
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

const RECIPE_NOTE_HEADING_PATTERN = /^(recipe\s+)?notes?:?\s*$/i;

type ImportedNoteEntry = {
  text: string;
  number?: number;
};

const splitInlineNumberedNotes = (value: string) => {
  const normalized = normalizeText(value).replace(/\\([.)])/g, "$1");
  if (!normalized) {
    return [] as ImportedNoteEntry[];
  }

  const markerPattern = /(^|\s)(\d+)[.)]\s+/g;
  const markerIndices: number[] = [];
  let markerMatch = markerPattern.exec(normalized);
  while (markerMatch) {
    markerIndices.push(markerMatch.index + markerMatch[1].length);
    markerMatch = markerPattern.exec(normalized);
  }

  if (markerIndices.length < 2) {
    const singleMatch = normalized.match(/^(\d+)[.)]\s+(.+)$/);
    if (singleMatch) {
      return [
        {
          text: normalizeText(singleMatch[2]),
          number: Number(singleMatch[1]),
        },
      ];
    }
    return [{ text: normalized }];
  }

  markerIndices.push(normalized.length);
  return markerIndices
    .slice(0, -1)
    .map((start, index) => {
      const segment = normalizeText(normalized.slice(start, markerIndices[index + 1]));
      const segmentMatch = segment.match(/^(\d+)[.)]\s*(.+)$/);
      if (segmentMatch) {
        return {
          text: normalizeText(segmentMatch[2]),
          number: Number(segmentMatch[1]),
        };
      }
      return { text: segment };
    })
    .filter((entry) => Boolean(entry.text));
};

const normalizeImportedNotes = (notes: string[]) => {
  const expanded = notes.flatMap((note) => splitInlineNumberedNotes(note));
  const deduped: ImportedNoteEntry[] = [];
  const seen = new Map<string, number>();

  for (const note of expanded) {
    const cleaned = normalizeText(note.text)
      .replace(/\\([.)])/g, "$1")
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+[.)]\s*/, "")
      .trim();
    if (!cleaned || RECIPE_NOTE_HEADING_PATTERN.test(cleaned) || /^note\s*\d+$/i.test(cleaned)) {
      continue;
    }

    const dedupeKey = cleaned.toLowerCase();
    const existingIndex = seen.get(dedupeKey);
    if (typeof existingIndex === "number") {
      if (typeof note.number === "number" && typeof deduped[existingIndex]?.number !== "number") {
        deduped[existingIndex] = { text: cleaned, number: note.number };
      }
      continue;
    }

    seen.set(dedupeKey, deduped.length);
    deduped.push({ text: cleaned, number: note.number });
  }

  return deduped.map((note) =>
    typeof note.number === "number" ? `${note.number}. ${note.text}` : note.text
  );
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

const parseYield = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const parsed = parseYield(entry);
      if (typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return undefined;
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

const normalizeIngredientHeading = (value: string) =>
  normalizeText(value).replace(/:\s*$/, "");

const isLikelyIngredientHeading = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }
  if (/\d/.test(normalized)) {
    return false;
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return false;
  }
  if (/:\s*$/.test(normalized)) {
    return true;
  }
  if (/^(for|to)\b/i.test(normalized)) {
    return true;
  }
  const letters = normalized.replace(/[^A-Za-z]/g, "");
  const uppercase = letters.replace(/[^A-Z]/g, "").length;
  const upperRatio = letters.length > 0 ? uppercase / letters.length : 0;
  if (upperRatio >= 0.8 && words.length >= 2 && letters.length >= 6) {
    return true;
  }
  if (
    words.length === 1 &&
    /^(sauce|dressing|marinade|filling|topping|crust|base|glaze|broth|stock|seasoning)$/i.test(normalized)
  ) {
    return true;
  }
  return false;
};

const extractIngredientGroupsFromLines = (lines: string[]): PrepGroup[] => {
  const groups: PrepGroup[] = [];
  const ungrouped: string[] = [];
  let current: PrepGroup | null = null;

  for (const line of lines) {
    const normalized = normalizeText(line).replace(/^[-*]\s*/, "");
    if (!normalized) {
      continue;
    }
    if (isLikelyIngredientHeading(normalized)) {
      const title = normalizeIngredientHeading(normalized);
      current = { title, items: [] };
      groups.push(current);
      continue;
    }
    if (current) {
      current.items.push(normalized);
    } else {
      ungrouped.push(normalized);
    }
  }

  if (groups.length > 0 && ungrouped.length > 0) {
    groups.push({ title: "Other Ingredients", items: ungrouped });
  }

  return groups.filter((group) => group.items.length > 0);
};

const extractWprmIngredientItems = (html: string) => {
  const items: string[] = [];
  const itemRegex =
    /<li[^>]+class=["'][^"']*wprm-recipe-ingredient[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match = itemRegex.exec(html);
  while (match) {
    const itemText = stripHtml(match[1]);
    if (itemText) {
      items.push(itemText);
    }
    match = itemRegex.exec(html);
  }
  return items;
};

const extractIngredientGroupsFromHtml = (html: string): PrepGroup[] => {
  const groups: PrepGroup[] = [];
  const groupRegex =
    /<div[^>]+class=["'][^"']*wprm-recipe-ingredient-group[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let match = groupRegex.exec(html);
  while (match) {
    const groupHtml = match[1];
    const titleMatch = groupHtml.match(
      /<[^>]+class=["'][^"']*wprm-recipe-group-name[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
    );
    const title = titleMatch ? normalizeIngredientHeading(stripHtml(titleMatch[1])) : "";
    const items = extractWprmIngredientItems(groupHtml);
    if (title && items.length > 0) {
      groups.push({ title, items });
    }
    match = groupRegex.exec(html);
  }
  return groups;
};

const cleanIngredientGroups = (groups: PrepGroup[]) => {
  const cleanedGroups: PrepGroup[] = [];
  const ingredients: string[] = [];
  const notes: string[] = [];

  for (const group of groups) {
    const title = normalizeIngredientHeading(group.title);
    const cleanedItems: string[] = [];

    for (const item of group.items) {
      const normalizedItem = item.replace(/^[-*]\s*/, "").trim();
      const result = cleanIngredientLine(normalizedItem);
      if (result.line) {
        cleanedItems.push(result.line);
        ingredients.push(result.line);
      }
      notes.push(...result.notes);
    }

    if (title && cleanedItems.length > 0) {
      cleanedGroups.push({ title, items: cleanedItems });
    }
  }

  return { groups: cleanedGroups, ingredients, notes };
};

const extractRecipeFromHtml = (html: string, preParsedBlocks?: unknown[]) => {
  const blocks = preParsedBlocks && preParsedBlocks.length > 0 ? preParsedBlocks : parseJsonLdBlocks(html);
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
  const ingredients = extractIngredientValue(recipe.recipeIngredient ?? recipe.ingredients);
  const ingredientGroups = extractIngredientGroupsFromHtml(html);
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
    ingredientGroups,
    instructions,
    tags,
    servings,
    prepTime,
    cookTime,
  };
};

type MarkdownFetchResponse = {
  success?: boolean;
  title?: string;
  content?: string;
};

const MARKDOWN_TOOL_URL = "https://markdown.new/";

const fetchMarkdownFromUrl = async (sourceUrl: string) => {
  try {
    const response = await fetch(MARKDOWN_TOOL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({ url: sourceUrl }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as MarkdownFetchResponse;
    if (!payload.success || typeof payload.content !== "string") {
      return null;
    }

    return {
      title: typeof payload.title === "string" ? normalizeText(payload.title) : undefined,
      content: payload.content,
    };
  } catch {
    return null;
  }
};

const extractRecipeFromMarkdown = (markdown: string, fallbackTitle?: string) => {
  const parsed = parseMarkdownRecipe(markdown, fallbackTitle);

  const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  const frontmatter = frontmatterMatch?.[1] ?? "";
  const frontmatterImage = frontmatter.match(/^\s*image\s*:\s*(.+)\s*$/im)?.[1];
  const frontmatterVideo =
    frontmatter.match(/^\s*(?:video|video_url|youtube)\s*:\s*(.+)\s*$/im)?.[1] ?? undefined;
  const imageMatch = markdown.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  const imageUrl = toOptionalUrlString(frontmatterImage ?? imageMatch?.[1] ?? "");
  const videoUrl =
    normalizeVideoUrl(toOptionalUrlString(frontmatterVideo ?? "")) ??
    normalizeVideoUrl(extractVideoFromHtml(markdown));

  return {
    title: parsed.title,
    description: parsed.description,
    imageUrl,
    videoUrl,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    notes: parsed.notes,
    tags: parsed.tags,
  };
};

const createFailedAttempt = (
  stage: IngestionAttemptResult["stage"],
  errorCode: IngestionErrorCode,
  latencyMs: number
): IngestionAttemptResult => ({
  stage,
  success: false,
  title: undefined,
  ingredients: [],
  instructions: [],
  notes: [],
  errorCode,
  latencyMs,
});

const classifyFetchStatus = (status: number): IngestionErrorCode => {
  if (status === 401 || status === 403 || status === 429) {
    return "blocked";
  }

  return "fetch_failed";
};

const cleanCandidateLines = (value: string[] | undefined) =>
  (value ?? []).map((line) => normalizeText(line)).filter(Boolean);

const getReadabilityExtractor = async () => {
  const readabilityModule = await import("@/lib/recipe-readability");
  return readabilityModule.extractRecipeFromReadability;
};

const buildCandidateFromHtml = ({
  stage,
  sourceUrl,
  html,
  jsonLdBlocks,
  latencyMs,
}: {
  stage: RecipeIngestionCandidate["stage"];
  sourceUrl: string;
  html: string;
  jsonLdBlocks?: unknown[];
  latencyMs: number;
}): RecipeIngestionCandidate | null => {
  const adapted = applyRecipeSiteAdapters(sourceUrl, html);
  const parsed = extractRecipeFromHtml(adapted.html, jsonLdBlocks);
  if (!parsed) {
    return null;
  }

  const title =
    parsed.title ||
    extractMeta(adapted.html, "og:title", "property") ||
    extractMeta(adapted.html, "twitter:title", "name") ||
    extractTitle(adapted.html);

  const description =
    parsed.description ||
    extractMeta(adapted.html, "description", "name") ||
    extractMeta(adapted.html, "og:description", "property") ||
    extractMeta(adapted.html, "twitter:description", "name");

  const imageUrl = toOptionalUrlString(
    parsed.imageUrl ??
    extractMeta(adapted.html, "og:image", "property") ??
    extractMeta(adapted.html, "twitter:image", "name") ??
    ""
  );
  const videoUrl = normalizeVideoUrl(parsed.videoUrl ?? extractVideoFromHtml(adapted.html));
  const hasContent = Boolean(
    title || description || parsed.ingredients.length > 0 || parsed.instructions.length > 0
  );

  return {
    stage,
    success: hasContent,
    title,
    description,
    imageUrl,
    videoUrl,
    ingredients: cleanCandidateLines(parsed.ingredients),
    instructions: cleanCandidateLines(parsed.instructions),
    notes: extractNotesFromHtml(adapted.html),
    tags: parsed.tags,
    servings: parsed.servings,
    prepTime: parsed.prepTime,
    cookTime: parsed.cookTime,
    ingredientGroups: parsed.ingredientGroups,
    latencyMs,
    html: adapted.html,
    errorCode: undefined,
  };
};

const buildReadabilityCandidate = async ({
  html,
  sourceUrl,
  latencyMs,
}: {
  html: string;
  sourceUrl: string;
  latencyMs: number;
}): Promise<RecipeIngestionCandidate | null> => {
  const extractRecipeFromReadability = await getReadabilityExtractor();
  const parsed = extractRecipeFromReadability(html, sourceUrl);
  if (!parsed) {
    return null;
  }

  return {
    stage: "readability",
    success: parsed.ingredients.length > 0 || parsed.instructions.length > 0 || Boolean(parsed.description),
    title: parsed.title,
    description: parsed.description,
    imageUrl: toOptionalUrlString(parsed.imageUrl ?? ""),
    videoUrl: normalizeVideoUrl(extractVideoFromHtml(html)),
    ingredients: cleanCandidateLines(parsed.ingredients),
    instructions: cleanCandidateLines(parsed.instructions),
    notes: cleanCandidateLines(parsed.notes),
    latencyMs,
    html,
    errorCode: undefined,
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
    ingredientCount: ingredients.length,
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

  const householdId = await getCurrentHouseholdId();

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

  const householdId = await getCurrentHouseholdId();

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
      ingredientCount: payload.ingredients.length,
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

  const householdId = await getCurrentHouseholdId();

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
  const startedAt = Date.now();
  const recipeId = toOptionalString(formData.get("recipeId"));
  const section = toOptionalString(formData.get("section"));
  if (!recipeId || !section) {
    logServerPerf({
      phase: "recipes.update_section_write",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      meta: { recipe_id: recipeId ?? null, section: section ?? null, reason: "missing_input" },
    });
    return;
  }

  let householdId: string | undefined;
  try {
    householdId = await getCurrentHouseholdId();
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, householdId },
    });

    if (!recipe) {
      logServerPerf({
        phase: "recipes.update_section_write",
        route: "/recipes/[id]",
        startedAt,
        success: false,
        householdId,
        meta: { recipe_id: recipeId, section, reason: "missing_recipe" },
      });
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
          ingredientCount: cleanedIngredients.lines.length,
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

    if (section === "overview") {
      const title = toOptionalString(formData.get("title")) ?? recipe.title;
      const description = toOptionalString(formData.get("description"));
      const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
      const imageUrl = toOptionalUrl(formData.get("imageUrl"));
      const videoUrl = toOptionalUrl(formData.get("videoUrl"));
      const servings = toOptionalInt(formData.get("servings"));
      const prepTime = toOptionalInt(formData.get("prepTime"));
      const cookTime = toOptionalInt(formData.get("cookTime"));
      const tags = parseTags(formData.get("tags")?.toString() ?? "");

      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          title,
          description: description ?? recipe.description,
          sourceUrl: normalizeSourceUrl(sourceUrl) ?? sourceUrl ?? recipe.sourceUrl,
          imageUrl: imageUrl ?? recipe.imageUrl,
          videoUrl: normalizeVideoUrl(videoUrl) ?? videoUrl ?? recipe.videoUrl,
          servings: servings ?? recipe.servings,
          prepTime: prepTime ?? recipe.prepTime,
          cookTime: cookTime ?? recipe.cookTime,
          tags: tags.length > 0 ? tags : recipe.tags,
        },
      });
    }
  } catch (error) {
    logServerPerf({
      phase: "recipes.update_section_write",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      householdId,
      meta: {
        recipe_id: recipeId,
        section,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }

  logServerPerf({
    phase: "recipes.update_section_write",
    route: "/recipes/[id]",
    startedAt,
    success: true,
    householdId,
    meta: { recipe_id: recipeId, section },
  });

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function importRecipeFromUrl(formData: FormData) {
  const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
  if (!sourceUrl) {
    redirect("/recipes?importError=invalid_url");
  }

  const householdId = await getCurrentHouseholdId();
  const existingRecipe = await findRecipeBySourceUrl(householdId, sourceUrl);
  const sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  const webMcpTrackingEnabled = process.env.INGEST_ENABLE_WEBMCP === "true";
  const attempts: IngestionAttemptResult[] = [];
  const candidates: RecipeIngestionCandidate[] = [];

  let markdownRecipe: ReturnType<typeof extractRecipeFromMarkdown> | null = null;
  let directHtml = "";
  let renderedHtml = "";
  let metadataFallback: Pick<RecipeIngestionCandidate, "tags" | "servings" | "prepTime" | "cookTime"> = {};

  const markdownStartedAt = Date.now();
  const markdownResult = await fetchMarkdownFromUrl(sourceUrl);
  const markdownLatencyMs = Date.now() - markdownStartedAt;
  const markdownTitle = markdownResult?.title;

  if (markdownResult?.content) {
    markdownRecipe = extractRecipeFromMarkdown(markdownResult.content, markdownResult.title);
    const markdownCandidate: RecipeIngestionCandidate = {
      stage: "markdown",
      success: Boolean(
        markdownRecipe.title ||
        markdownRecipe.description ||
        markdownRecipe.ingredients.length > 0 ||
        markdownRecipe.instructions.length > 0
      ),
      title: markdownRecipe.title,
      description: markdownRecipe.description,
      imageUrl: markdownRecipe.imageUrl,
      videoUrl: markdownRecipe.videoUrl,
      ingredients: cleanCandidateLines(markdownRecipe.ingredients),
      instructions: cleanCandidateLines(markdownRecipe.instructions),
      notes: cleanCandidateLines(markdownRecipe.notes),
      tags: markdownRecipe.tags,
      latencyMs: markdownLatencyMs,
      errorCode: undefined,
    };

    if (markdownCandidate.success) {
      attempts.push(markdownCandidate);
      candidates.push(markdownCandidate);
    } else {
      attempts.push(createFailedAttempt("markdown", "parse_failed", markdownLatencyMs));
    }
  } else {
    attempts.push(createFailedAttempt("markdown", "fetch_failed", markdownLatencyMs));
  }

  let selected = selectBestRecipeIngestionCandidate(candidates);
  const markdownHasBalancedSections =
    selected.candidate?.stage === "markdown" &&
    selected.candidate.ingredients.length >= 4 &&
    selected.candidate.instructions.length >= 3;
  const markdownIsHighConfidence =
    selected.candidate?.stage === "markdown" &&
    selected.score >= HIGH_CONFIDENCE_INGESTION_SCORE &&
    markdownHasBalancedSections;

  if (markdownIsHighConfidence && (!markdownRecipe?.imageUrl || !markdownRecipe?.videoUrl)) {
    const mediaHtmlStartedAt = Date.now();
    const mediaHtmlController = new AbortController();
    const mediaHtmlTimeout = setTimeout(() => mediaHtmlController.abort(), 6000);
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "MiseEnPlaceBot/2.0",
        },
        cache: "no-store",
        signal: mediaHtmlController.signal,
      });

      if (response.ok) {
        directHtml = await response.text();
        const mediaHtmlLatencyMs = Date.now() - mediaHtmlStartedAt;
        const metadataCandidate = buildCandidateFromHtml({
          stage: "http_html",
          sourceUrl,
          html: directHtml,
          latencyMs: mediaHtmlLatencyMs,
        });
        if (metadataCandidate) {
          metadataFallback = {
            tags: metadataCandidate.tags?.length ? metadataCandidate.tags : undefined,
            servings: metadataCandidate.servings,
            prepTime: metadataCandidate.prepTime,
            cookTime: metadataCandidate.cookTime,
          };
        }
        attempts.push({
          stage: "http_html",
          success: true,
          title: undefined,
          ingredients: [],
          instructions: [],
          notes: [],
          latencyMs: mediaHtmlLatencyMs,
          errorCode: undefined,
        });
      } else {
        attempts.push(
          createFailedAttempt("http_html", classifyFetchStatus(response.status), Date.now() - mediaHtmlStartedAt)
        );
      }
    } catch (error) {
      const mediaHtmlLatencyMs = Date.now() - mediaHtmlStartedAt;
      const timeoutError =
        error instanceof DOMException && error.name === "AbortError" ? "timeout" : "fetch_failed";
      attempts.push(createFailedAttempt("http_html", timeoutError, mediaHtmlLatencyMs));
    } finally {
      clearTimeout(mediaHtmlTimeout);
    }
  }

  if (!markdownIsHighConfidence) {
    const htmlStartedAt = Date.now();
    const htmlController = new AbortController();
    const htmlTimeout = setTimeout(() => htmlController.abort(), 10000);
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "MiseEnPlaceBot/2.0",
        },
        cache: "no-store",
        signal: htmlController.signal,
      });
      const htmlLatencyMs = Date.now() - htmlStartedAt;
      if (!response.ok) {
        attempts.push(createFailedAttempt("http_html", classifyFetchStatus(response.status), htmlLatencyMs));
      } else {
        directHtml = await response.text();
        const htmlCandidate = buildCandidateFromHtml({
          stage: "http_html",
          sourceUrl,
          html: directHtml,
          latencyMs: htmlLatencyMs,
        });
        if (htmlCandidate?.success) {
          attempts.push(htmlCandidate);
          candidates.push(htmlCandidate);
        } else {
          attempts.push(createFailedAttempt("http_html", "parse_failed", htmlLatencyMs));
        }
      }
    } catch (error) {
      const htmlLatencyMs = Date.now() - htmlStartedAt;
      const timeoutError =
        error instanceof DOMException && error.name === "AbortError" ? "timeout" : "fetch_failed";
      attempts.push(createFailedAttempt("http_html", timeoutError, htmlLatencyMs));
    } finally {
      clearTimeout(htmlTimeout);
    }
  }

  selected = selectBestRecipeIngestionCandidate(candidates);

  if (selected.score < MIN_INGESTION_SCORE && isRenderFallbackEnabled()) {
    const renderedStartedAt = Date.now();
    const renderedCandidatePayload = await fetchRenderedRecipeCandidate(sourceUrl);
    const renderedLatencyMs = Date.now() - renderedStartedAt;

    if (renderedCandidatePayload) {
      renderedHtml = renderedCandidatePayload.html;
      const renderedCandidate = buildCandidateFromHtml({
        stage: "rendered_html",
        sourceUrl: renderedCandidatePayload.finalUrl ?? sourceUrl,
        html: renderedCandidatePayload.html,
        jsonLdBlocks: renderedCandidatePayload.jsonLd,
        latencyMs: renderedLatencyMs,
      });

      if (renderedCandidate?.success) {
        attempts.push(renderedCandidate);
        candidates.push(renderedCandidate);
      } else {
        attempts.push(createFailedAttempt("rendered_html", "parse_failed", renderedLatencyMs));
      }
    } else {
      attempts.push(createFailedAttempt("rendered_html", "fetch_failed", renderedLatencyMs));
    }
  }

  selected = selectBestRecipeIngestionCandidate(candidates);

  if (selected.score < MIN_INGESTION_SCORE) {
    const readabilitySourceHtml = renderedHtml || directHtml;
    if (readabilitySourceHtml) {
      const readabilityStartedAt = Date.now();
      const readabilityCandidate = await buildReadabilityCandidate({
        html: readabilitySourceHtml,
        sourceUrl,
        latencyMs: Date.now() - readabilityStartedAt,
      });

      if (readabilityCandidate?.success) {
        attempts.push(readabilityCandidate);
        candidates.push(readabilityCandidate);
      } else {
        attempts.push(
          createFailedAttempt("readability", "parse_failed", Date.now() - readabilityStartedAt)
        );
      }
    }
  }

  selected = selectBestRecipeIngestionCandidate(candidates);
  const markdownNeedsRescue =
    selected.candidate?.stage === "markdown" &&
    (selected.candidate.ingredients.length < 4 || selected.candidate.instructions.length < 3);
  if (markdownNeedsRescue) {
    const balancedFallbackCandidates = candidates.filter(
      (candidate) =>
        candidate.stage !== "markdown" &&
        candidate.ingredients.length >= 4 &&
        candidate.instructions.length >= 3
    );
    if (balancedFallbackCandidates.length > 0) {
      selected = selectBestRecipeIngestionCandidate(balancedFallbackCandidates);
    }
  }

  const selectedCandidate = selected.candidate;
  const failureReason = classifyIngestionFailure(attempts, selectedCandidate);

  if (!selectedCandidate || selected.score < MIN_INGESTION_SCORE) {
    logRecipeIngestionDiagnostics({
      sourceUrl,
      sourceHost,
      resultQualityScore: selected.score,
      failureReason,
      attempts: attempts.map((attempt) => ({
        stage: attempt.stage,
        success: attempt.success,
        latencyMs: attempt.latencyMs,
        errorCode: attempt.errorCode,
        ingredients: attempt.ingredients.length,
        instructions: attempt.instructions.length,
      })),
    });

    if (existingRecipe) {
      redirect(`/recipes/${existingRecipe.id}`);
    }

    redirect(`/recipes?importError=${failureReason}`);
  }

  const candidateHtml = selectedCandidate.html || renderedHtml || directHtml;
  const title =
    selectedCandidate.title ||
    markdownTitle ||
    extractMeta(candidateHtml, "og:title", "property") ||
    extractMeta(candidateHtml, "twitter:title", "name") ||
    extractTitle(candidateHtml) ||
    sourceHost;
  const ingredientGroupCandidates =
    selectedCandidate.ingredientGroups?.length
      ? selectedCandidate.ingredientGroups
      : extractIngredientGroupsFromLines(selectedCandidate.ingredients);
  const groupedIngredients =
    ingredientGroupCandidates.length > 0
      ? cleanIngredientGroups(ingredientGroupCandidates)
      : null;
  const hasGroupedIngredients = Boolean(
    groupedIngredients &&
      groupedIngredients.groups.length > 0 &&
      groupedIngredients.ingredients.length > 0
  );
  const cleanedIngredients = hasGroupedIngredients
    ? { lines: groupedIngredients!.ingredients, notes: groupedIngredients!.notes }
    : cleanIngredientLines(selectedCandidate.ingredients);
  const cleanedInstructions = cleanInstructionLines(selectedCandidate.instructions);
  const htmlNotes = candidateHtml ? extractNotesFromHtml(candidateHtml) : [];
  const instructionPrepGroups = buildPrepGroupsFromInstructions(
    cleanedIngredients.lines,
    cleanedInstructions.lines
  );
  const prepGroups =
    hasGroupedIngredients
      ? groupedIngredients!.groups
      : instructionPrepGroups.length > 0
        ? instructionPrepGroups
        : buildPrepGroups(cleanedIngredients.lines);
  const rawDescription =
    selectedCandidate.description ||
    extractMeta(candidateHtml, "description", "name") ||
    extractMeta(candidateHtml, "og:description", "property") ||
    extractMeta(candidateHtml, "twitter:description", "name");
  const descriptionCandidate = cleanDescription(rawDescription);
  const { description, notes: descriptionNotes } = extractNotesFromDescription(
    descriptionCandidate
  );
  const imageUrl = toOptionalUrl(
    selectedCandidate.imageUrl ??
    extractMeta(candidateHtml, "og:image", "property") ??
    extractMeta(candidateHtml, "twitter:image", "name") ??
    null
  );
  const rawVideoUrl = selectedCandidate.videoUrl ?? extractVideoFromHtml(candidateHtml);
  const normalizedVideoUrl = normalizeVideoUrl(rawVideoUrl);
  const videoUrl =
    getVideoKind(normalizedVideoUrl) === "youtube"
      ? normalizedVideoUrl
      : normalizedVideoUrl ?? undefined;
  const finalTags =
    selectedCandidate.tags?.length
      ? selectedCandidate.tags
      : markdownRecipe?.tags?.length
        ? markdownRecipe.tags
        : metadataFallback.tags ?? [];
  const finalServings = selectedCandidate.servings ?? metadataFallback.servings ?? null;
  const finalPrepTime = selectedCandidate.prepTime ?? metadataFallback.prepTime ?? null;
  const finalCookTime = selectedCandidate.cookTime ?? metadataFallback.cookTime ?? null;
  const notes = normalizeImportedNotes(
    Array.from(
      new Set([
      ...cleanedIngredients.notes,
      ...cleanedInstructions.notes,
      ...(markdownRecipe?.notes ?? []),
      ...selectedCandidate.notes,
      ...htmlNotes,
      ...descriptionNotes,
      ])
    )
  );

  logRecipeIngestionDiagnostics({
    sourceUrl,
    sourceHost,
    stageUsed: selectedCandidate.stage,
    resultQualityScore: selected.score,
    attempts: attempts.map((attempt) => ({
      stage: attempt.stage,
      success: attempt.success,
      latencyMs: attempt.latencyMs,
      errorCode: attempt.errorCode,
      ingredients: attempt.ingredients.length,
      instructions: attempt.instructions.length,
    })),
    selected: {
      stage: selectedCandidate.stage,
      title: selectedCandidate.title,
      ingredients: selectedCandidate.ingredients,
      instructions: selectedCandidate.instructions,
    },
    webMcpTrackingEnabled,
  });

  const normalizedSourceUrl = normalizeSourceUrl(sourceUrl) ?? sourceUrl;

  if (existingRecipe) {
    const existing = await prisma.recipe.findFirst({
      where: { id: existingRecipe.id, householdId },
      select: {
        id: true,
        imageUrl: true,
        videoUrl: true,
        servings: true,
        prepTime: true,
        cookTime: true,
        tags: true,
      },
    });

    if (existing) {
      const existingKind = getVideoKind(existing.videoUrl ?? undefined);
      const nextKind = getVideoKind(videoUrl ?? undefined);
      const shouldUpdateVideo =
        (!existing.videoUrl && videoUrl) ||
        (existingKind !== "youtube" && nextKind === "youtube") ||
        (existingKind === null && nextKind !== null);
      const shouldUpdateImage = !existing.imageUrl && imageUrl;
      const shouldUpdateServings =
        (existing.servings === null || existing.servings === undefined) &&
        typeof finalServings === "number";
      const shouldUpdatePrepTime =
        (existing.prepTime === null || existing.prepTime === undefined) &&
        typeof finalPrepTime === "number";
      const shouldUpdateCookTime =
        (existing.cookTime === null || existing.cookTime === undefined) &&
        typeof finalCookTime === "number";
      const shouldUpdateTags =
        (!Array.isArray(existing.tags) || existing.tags.length === 0) &&
        finalTags.length > 0;

      if (
        shouldUpdateVideo ||
        shouldUpdateImage ||
        shouldUpdateServings ||
        shouldUpdatePrepTime ||
        shouldUpdateCookTime ||
        shouldUpdateTags
      ) {
        await prisma.recipe.update({
          where: { id: existing.id },
          data: {
            imageUrl: shouldUpdateImage ? imageUrl : undefined,
            videoUrl: shouldUpdateVideo ? videoUrl : undefined,
            servings: shouldUpdateServings ? finalServings : undefined,
            prepTime: shouldUpdatePrepTime ? finalPrepTime : undefined,
            cookTime: shouldUpdateCookTime ? finalCookTime : undefined,
            tags: shouldUpdateTags ? finalTags : undefined,
          },
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
      title,
      description,
      sourceUrl: normalizedSourceUrl,
      imageUrl,
      videoUrl,
      servings: finalServings,
      prepTime: finalPrepTime,
      cookTime: finalCookTime,
      tags: finalTags,
      ingredientCount: cleanedIngredients.lines.length,
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

  const householdId = await getCurrentHouseholdId();

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
  if (!recipeId || !dateKey) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  const date = fromDateKey(dateKey);
  const mealTypeOrder = ["DINNER", "LUNCH", "BREAKFAST", "SNACK"] as const;
  const existingForDay = await prisma.mealPlan.findMany({
    where: { householdId, date },
    select: { mealType: true, recipeId: true },
  });

  const alreadyAdded = existingForDay.some((plan) => plan.recipeId === recipeId);
  if (alreadyAdded) {
    redirect("/planner");
  }

  const occupied = new Set(existingForDay.map((plan) => plan.mealType));
  const nextMealType = mealTypeOrder.find((mealType) => !occupied.has(mealType));
  if (!nextMealType) {
    redirect("/planner");
  }

  await prisma.mealPlan.create({
    data: {
      householdId,
      recipeId,
      date,
      mealType: nextMealType,
      servings: 2,
    },
  });

  revalidatePath("/planner");
  revalidatePath("/shopping");
  redirect("/planner");
}
