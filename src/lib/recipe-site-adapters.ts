const stripNoscriptBlocks = (html: string) => html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

const decodeHtml = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const normalizeText = (value: string) =>
  decodeHtml(value.replace(/<!--\s*-->/g, ""))
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();

const stripHtml = (value: string) =>
  normalizeText(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|tr|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  );

const extractFirst = (html: string, regex: RegExp) => {
  const match = html.match(regex);
  return match?.[1] ? normalizeText(match[1]) : undefined;
};

const extractSection = (html: string, startId: string, endId?: string) => {
  const start = html.search(new RegExp(`<[^>]+id=["']${startId}["'][^>]*>`, "i"));
  if (start === -1) {
    return "";
  }

  const rest = html.slice(start);
  if (!endId) {
    return rest;
  }

  const end = rest.search(new RegExp(`<[^>]+id=["']${endId}["'][^>]*>`, "i"));
  return end === -1 ? rest : rest.slice(0, end);
};

const parseCookTime = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const minutes = value.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
  const total =
    (hours ? Math.round(Number(hours[1]) * 60) : 0) + (minutes ? Number(minutes[1]) : 0);

  return total > 0 ? `PT${total}M` : undefined;
};

const extractCabaggesRecipe = (html: string) => {
  const title = extractFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const intro = extractSection(html, "recipe-intro", "recipe-ingredients");
  const description = stripHtml(extractFirst(intro, /<div[^>]+class=["'][^"']*\btext-large\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ?? "");
  const timeLabel = extractFirst(intro, /<span[^>]*>\s*([^<]*\b(?:mins?|minutes?|hours?|hrs?)\b[^<]*)<\/span>/i);
  const servesLabel = extractFirst(intro, /<span[^>]*>\s*(Serves?\s+[^<]+)<\/span>/i);
  const servings = servesLabel?.replace(/^serves?\s+/i, "");
  const categories = Array.from(intro.matchAll(/href=["']\/recipes\?category=[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => stripHtml(match[1]))
    .map((category) => category.replace(/,+$/, "").trim())
    .filter(Boolean);

  const ingredientsSection = extractSection(html, "recipe-ingredients", "recipe-method");
  const ingredients = Array.from(ingredientsSection.matchAll(/<img\b[\s\S]*?<\/div><div>([^<>]+)<\/div><\/div>/gi))
    .map((match) => normalizeText(match[1]))
    .filter((line) => line && !/^view as\b/i.test(line));

  const methodSection = extractSection(html, "recipe-method", "related-recipes");
  const instructions = Array.from(methodSection.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  const videoUrl = methodSection.match(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i)?.[1];

  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return null;
  }

  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: title,
    description: description || undefined,
    keywords: categories.length > 0 ? categories.join(", ") : undefined,
    recipeYield: servings,
    cookTime: parseCookTime(timeLabel),
    recipeIngredient: ingredients,
    recipeInstructions: instructions.map((text) => ({
      "@type": "HowToStep",
      text,
    })),
    video: videoUrl ? { "@type": "VideoObject", contentUrl: decodeHtml(videoUrl) } : undefined,
  };
};

const injectCabaggesJsonLd = (html: string) => {
  if (/type=["']application\/ld\+json["']/i.test(html)) {
    return html;
  }

  const recipe = extractCabaggesRecipe(html);
  if (!recipe) {
    return html;
  }

  const json = JSON.stringify(recipe).replace(/</g, "\\u003c");
  return `${html}<script type="application/ld+json">${json}</script>`;
};

const removeDuplicateWprmBlocks = (html: string) => {
  const blockRegex = /(<div[^>]+class=["'][^"']*wprm-recipe-container[^"']*["'][^>]*>[\s\S]*?<\/div>)/gi;
  const matches = html.match(blockRegex);
  if (!matches || matches.length <= 1) {
    return html;
  }

  return html.replace(blockRegex, (_, block: string, offset: number) => {
    const firstIndex = html.indexOf(block);
    return firstIndex === offset ? block : "";
  });
};

type AdapterResult = {
  html: string;
  adapter?: string;
};

const ADAPTERS: Array<{
  id: string;
  hostPattern: RegExp;
  run: (html: string) => string;
}> = [
  {
    id: "wprm-dedupe",
    hostPattern: /(^|\.)allrecipes\.com$|(^|\.)foodnetwork\.com$|(^|\.)pinchofyum\.com$/i,
    run: removeDuplicateWprmBlocks,
  },
  {
    id: "cabagges-json-ld",
    hostPattern: /(^|\.)cabagges\.world$/i,
    run: injectCabaggesJsonLd,
  },
  {
    id: "noscript-strip",
    hostPattern: /./,
    run: stripNoscriptBlocks,
  },
];

export const applyRecipeSiteAdapters = (sourceUrl: string, html: string): AdapterResult => {
  let hostname = "";

  try {
    hostname = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return { html };
  }

  let nextHtml = html;
  const applied: string[] = [];

  for (const adapter of ADAPTERS) {
    if (!adapter.hostPattern.test(hostname)) {
      continue;
    }

    const transformed = adapter.run(nextHtml);
    if (transformed !== nextHtml) {
      nextHtml = transformed;
      applied.push(adapter.id);
    }
  }

  return {
    html: nextHtml,
    adapter: applied.length > 0 ? applied.join(",") : undefined,
  };
};
