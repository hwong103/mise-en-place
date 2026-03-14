export type WineVisionResult = {
    name: string;
    producer?: string;
    vintage?: number;
    grapes?: string[];
    region?: string;
    country?: string;
    type?: "RED" | "WHITE" | "SPARKLING" | "ROSE" | "DESSERT" | "FORTIFIED" | "OTHER";
    imageUrl?: string;
    tastingNotes?: string;
    tasteProfile?: string[];
};

type WineType = "RED" | "WHITE" | "SPARKLING" | "ROSE" | "DESSERT" | "FORTIFIED" | "OTHER";

const PLACEHOLDER_KEY_PATTERN = /^(your_?key|changeme|replace_me|test|example|null|undefined)/i;

const hasUsableApiKey = (key: string | undefined): key is string =>
    Boolean(key && key.trim() && !PLACEHOLDER_KEY_PATTERN.test(key.trim()));

const cleanJsonBlock = (raw: string) =>
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

const parsePrice = (value: string | undefined) => {
    if (!value) return NaN;
    const numeric = value.replace(/[^0-9.,]/g, "").replace(/,/g, "");
    return numeric ? Number(numeric) : NaN;
};

const normalizeSearchText = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s'-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const stripLeadingVintage = (value: string) =>
    value.replace(/^\s*(?:19|20)\d{2}\s+/, "").trim();

const MARKDOWN_TOOL_URL = "https://markdown.new/";

const COUNTRY_TAGS = new Set([
    "argentina", "australia", "austria", "chile", "france", "germany", "greece", "hungary", "italy",
    "new zealand", "portugal", "south africa", "spain", "united states", "usa", "uruguay", "georgia",
]);

const REGION_TAGS = new Set([
    "barossa", "barossa valley", "beaujolais", "bordeaux", "burgundy", "chablis", "chianti", "douro",
    "fleurie", "languedoc", "loire", "margaret river", "marlborough", "mclaren vale", "mendoza", "mosel",
    "napa", "napa valley", "provence", "rhone", "rioja", "sonoma", "tuscany", "willamette valley", "yarra valley",
]);

const GRAPE_CANONICAL: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /\bgamay(?:\s*noir)?\b/i, name: "Gamay" },
    { pattern: /\bpinot\s*noir\b/i, name: "Pinot Noir" },
    { pattern: /\bpinot\s*gris\b/i, name: "Pinot Gris" },
    { pattern: /\bpinot\s*grigio\b/i, name: "Pinot Grigio" },
    { pattern: /\bshiraz\b/i, name: "Shiraz" },
    { pattern: /\bsyrah\b/i, name: "Syrah" },
    { pattern: /\bcabernet\s*sauvignon\b/i, name: "Cabernet Sauvignon" },
    { pattern: /\bmerlot\b/i, name: "Merlot" },
    { pattern: /\bchardonnay\b/i, name: "Chardonnay" },
    { pattern: /\bsauvignon\s*blanc\b/i, name: "Sauvignon Blanc" },
    { pattern: /\briesling\b/i, name: "Riesling" },
    { pattern: /\bgrenache\b/i, name: "Grenache" },
    { pattern: /\bmalbec\b/i, name: "Malbec" },
    { pattern: /\btempranillo\b/i, name: "Tempranillo" },
    { pattern: /\bsangiovese\b/i, name: "Sangiovese" },
    { pattern: /\bnebbiolo\b/i, name: "Nebbiolo" },
];

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

const titleFromHandle = (handle: string) =>
    decodeURIComponent(handle)
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const stripHtml = (value: string) =>
    normalizeText(
        value
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/(p|li|div|tr|h\d)>/gi, "\n")
            .replace(/<li[^>]*>/gi, "- ")
            .replace(/<[^>]+>/g, " ")
    );

const uniqueStrings = (values: Array<string | undefined | null>) => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        if (!value) continue;
        const cleaned = normalizeText(value);
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(cleaned);
    }
    return result;
};

const toAbsoluteUrl = (value: string | undefined, pageUrl: string) => {
    if (!value) return undefined;
    try {
        return new URL(value, pageUrl).toString();
    } catch {
        return value;
    }
};

const firstNonEmpty = (...values: Array<string | undefined | null>) => {
    for (const value of values) {
        const normalized = typeof value === "string" ? normalizeText(value) : "";
        if (normalized) return normalized;
    }
    return undefined;
};

const parseJsonSafely = <T>(value: string): T | undefined => {
    try {
        return JSON.parse(value) as T;
    } catch {
        return undefined;
    }
};

const getMetaContent = (html: string, name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const byProperty = html.match(
        new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["']`, "i")
    );
    const byName = html.match(
        new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i")
    ) ?? html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["']`, "i")
    );
    return (byProperty?.[1] ?? byName?.[1])?.trim();
};

const inferWineType = (text: string): WineType | undefined => {
    const normalized = text.toLowerCase();
    if (/(sparkling|champagne|prosecco|cava|pet[-\s]?nat|cr[ée]mant)/i.test(normalized)) return "SPARKLING";
    if (/(ros[eé])/.test(normalized)) return "ROSE";
    if (/(dessert|ice\s*wine|late\s*harvest|sauternes|tokaji|passito)/i.test(normalized)) return "DESSERT";
    if (/(fortified|port|sherry|madeira|marsala|vermouth)/i.test(normalized)) return "FORTIFIED";
    if (/(white|chardonnay|riesling|pinot\s*gris|pinot\s*grigio|sauvignon\s*blanc|semillon|viognier)/i.test(normalized)) return "WHITE";
    if (/(red|pinot\s*noir|shiraz|syrah|cabernet|merlot|nebbiolo|sangiovese|tempranillo|grenache|malbec)/i.test(normalized)) return "RED";
    return undefined;
};

const inferProducerFromTitle = (title: string) => {
    const producerMatch = title.match(/^([A-Za-zÀ-ÿ0-9&.'\-\s]{3,50}?)(?:\s+(?:beaujolais|bordeaux|bourgogne|burgundy|chablis|shiraz|syrah|cabernet|merlot|pinot|chardonnay|riesling|sauvignon|prosecco|champagne)\b)/i);
    return producerMatch?.[1]?.replace(/[\s\-–—]+$/, "").trim();
};

const parseWineType = (value: string | undefined): WineType | undefined => {
    if (!value) return undefined;
    const normalized = normalizeText(value).toUpperCase();
    if (normalized in { RED: 1, WHITE: 1, SPARKLING: 1, ROSE: 1, DESSERT: 1, FORTIFIED: 1, OTHER: 1 }) {
        return normalized as WineType;
    }
    return inferWineType(value);
};

const extractYearFromText = (value: string | undefined) => {
    if (!value) return undefined;
    const match = value.match(/\b(19|20)\d{2}\b/);
    return match ? Number(match[0]) : undefined;
};

const extractGrapesFromText = (value: string | undefined) => {
    if (!value) return [];
    const output: string[] = [];
    for (const grape of GRAPE_CANONICAL) {
        if (grape.pattern.test(value)) {
            output.push(grape.name);
        }
    }
    return uniqueStrings(output);
};

const splitGrapes = (value: string | undefined) =>
    uniqueStrings(
        (value ?? "")
            .split(/[,&/]|(?:\band\b)/i)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .flatMap((entry) => extractGrapesFromText(entry).length > 0 ? extractGrapesFromText(entry) : [entry])
    );

const extractShopifyProductJson = (html: string) => {
    const match = html.match(
        /<script[^>]+id=["'][^"']*ProductJson[^"']*["'][^>]*>([\s\S]*?)<\/script>/i
    );
    const raw = match?.[1]?.trim();
    if (!raw) return undefined;
    return parseJsonSafely<{
        title?: string;
        vendor?: string;
        type?: string;
        tags?: string[];
        description?: string;
        content?: string;
        featured_image?: string;
        images?: string[];
    }>(raw);
};

const extractJsonLdProducts = (html: string) => {
    const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    const results: Array<Record<string, unknown>> = [];
    let match = regex.exec(html);
    while (match) {
        const raw = match[1]?.trim();
        if (!raw) {
            match = regex.exec(html);
            continue;
        }
        const block = parseJsonSafely<unknown>(raw);
        if (!block) {
            match = regex.exec(html);
            continue;
        }
        const queue: unknown[] = [block];
        while (queue.length > 0) {
            const current = queue.shift();
            if (Array.isArray(current)) {
                queue.push(...current);
                continue;
            }
            if (!current || typeof current !== "object") continue;
            const record = current as Record<string, unknown>;
            const type = record["@type"];
            if (
                (typeof type === "string" && /product|wine/i.test(type))
                || (Array.isArray(type) && type.some((entry) => typeof entry === "string" && /product|wine/i.test(entry)))
            ) {
                results.push(record);
            }
            if (record["@graph"]) queue.push(record["@graph"]);
        }
        match = regex.exec(html);
    }
    return results;
};

const extractInfoMap = (html: string) => {
    const info = new Map<string, string>();
    const setInfo = (key: string, value: string) => {
        const normalizedKey = normalizeText(key).toLowerCase().replace(/:\s*$/, "");
        const normalizedValue = stripHtml(value);
        if (!normalizedKey || !normalizedValue) return;
        if (!info.has(normalizedKey)) {
            info.set(normalizedKey, normalizedValue);
        }
    };

    const infoParagraphRegex = /<p[^>]*class=["'][^"']*weboost_info_p[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
    let paragraphMatch = infoParagraphRegex.exec(html);
    while (paragraphMatch) {
        const block = paragraphMatch[1];
        const labelMatch = block.match(/<span[^>]*class=["'][^"']*weboost_info_span[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        if (labelMatch) {
            const label = stripHtml(labelMatch[1]);
            const value = stripHtml(block.replace(labelMatch[0], "").replace(/<\/?span[^>]*>/gi, " "));
            setInfo(label, value);
        }
        paragraphMatch = infoParagraphRegex.exec(html);
    }

    const tableRegex = /<tr[^>]*>\s*(?:<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>|<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>)\s*<\/tr>/gi;
    let tableMatch = tableRegex.exec(html);
    while (tableMatch) {
        const key = stripHtml(tableMatch[1] ?? tableMatch[3] ?? "");
        const value = stripHtml(tableMatch[2] ?? tableMatch[4] ?? "");
        if (key && value) setInfo(key, value);
        tableMatch = tableRegex.exec(html);
    }

    return info;
};

type TasteProfileEntry = {
    labels: string[];
    percent: number;
};

const extractTasteProfileEntries = (html: string): TasteProfileEntry[] => {
    const entries: TasteProfileEntry[] = [];
    const regex = /<div[^>]*class=["'][^"']*weboost_process_title_section[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class=["'][^"']*process[^"']*["'][^>]*>[\s\S]*?<div[^>]*class=["'][^"']*process-bar[^"']*["'][^>]*style=["'][^"']*width:\s*([0-9.]+)%[^"']*["'][^>]*>/gi;
    let match = regex.exec(html);
    while (match) {
        const labelsBlock = match[1] ?? "";
        const labels = [...labelsBlock.matchAll(/<p[^>]*class=["'][^"']*weboost_process_title[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi)]
            .map((entry) => stripHtml(entry[1] ?? ""))
            .filter(Boolean);
        const percent = Number(match[2]);
        if (labels.length > 0 && Number.isFinite(percent)) {
            entries.push({ labels, percent: Math.max(0, Math.min(100, percent)) });
        }
        match = regex.exec(html);
    }
    return entries;
};

const describeTasteProfile = (entries: TasteProfileEntry[]) => {
    const lines: string[] = [];
    for (const entry of entries) {
        const percent = Math.round(entry.percent);
        if (entry.labels.length === 1) {
            lines.push(`${entry.labels[0]}: ${percent}%`);
            continue;
        }
        const [left, right] = entry.labels;
        const key = `${left.toLowerCase()}|${right.toLowerCase()}`;
        const dimension =
            key.includes("light|full") ? "Body"
                : key.includes("dry|sweet") ? "Sweetness"
                    : key.includes("fruity|savoury") ? "Fruit vs Savoury"
                        : `${left} vs ${right}`;
        const dominant = percent > 50 ? right : left;
        const descriptor = percent === 50 ? "Balanced" : dominant;
        lines.push(`${dimension}: ${descriptor} (${percent}%)`);
    }
    return uniqueStrings(lines);
};

const extractTastingNotesFromHtml = (html: string) => {
    const fromOverview = html.match(
        /<[^>]*class=["'][^"']*weboost_product_overview[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
    )?.[1];
    const fromMeta = getMetaContent(html, "og:description") ?? getMetaContent(html, "description");
    return firstNonEmpty(stripHtml(fromOverview ?? ""), fromMeta);
};

const extractBestCountryFromTags = (tags: string[]) => {
    for (const tag of tags) {
        const normalized = normalizeText(tag).toLowerCase();
        if (COUNTRY_TAGS.has(normalized)) {
            return tag;
        }
    }
    return undefined;
};

const extractBestRegionFromTags = (tags: string[]) => {
    for (const tag of tags) {
        const normalized = normalizeText(tag).toLowerCase();
        if (REGION_TAGS.has(normalized)) {
            return tag;
        }
    }
    return undefined;
};

const renderTastingNotes = (notes: string | undefined, tasteProfile: string[]) => {
    const cleanNotes = firstNonEmpty(notes);
    if (tasteProfile.length === 0) {
        return cleanNotes;
    }
    const tasteProfileBlock = `Taste Profile:\n${tasteProfile.map((line) => `- ${line}`).join("\n")}`;
    if (!cleanNotes) {
        return tasteProfileBlock;
    }
    if (cleanNotes.toLowerCase().includes("taste profile")) {
        return cleanNotes;
    }
    return `${cleanNotes}\n\n${tasteProfileBlock}`;
};

const scoreWineCandidate = (candidate: WineVisionResult | null) => {
    if (!candidate) return 0;
    return [
        candidate.name ? 2 : 0,
        candidate.producer ? 1 : 0,
        candidate.vintage ? 1 : 0,
        candidate.grapes?.length ? 1 : 0,
        candidate.region ? 1 : 0,
        candidate.country ? 1 : 0,
        candidate.type ? 1 : 0,
        candidate.tastingNotes ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);
};

const selectBestWineCandidate = (candidates: Array<WineVisionResult | null>) =>
    candidates
        .filter((candidate): candidate is WineVisionResult => Boolean(candidate?.name))
        .sort((a, b) => scoreWineCandidate(b) - scoreWineCandidate(a))[0] ?? null;

type MarkdownFetchResponse = {
    success?: boolean;
    title?: string;
    content?: string;
};

const fetchMarkdownFromUrl = async (sourceUrl: string) => {
    try {
        const response = await fetch(MARKDOWN_TOOL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ url: sourceUrl }),
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as MarkdownFetchResponse;
        if (!payload.success || typeof payload.content !== "string") return null;
        return {
            title: typeof payload.title === "string" ? normalizeText(payload.title) : undefined,
            content: payload.content,
        };
    } catch {
        return null;
    }
};

const extractWineCandidateFromMarkdown = (markdown: string, fallbackTitle?: string): WineVisionResult | null => {
    const normalized = markdown.replace(/\r\n/g, "\n");
    const headingTitle = normalized.match(/^\s*#\s+(.+)$/m)?.[1];
    const title = firstNonEmpty(headingTitle, fallbackTitle);
    if (!title) return null;

    const kvMatches = [...normalized.matchAll(/^\s*(Type|Varietal(?: Blend)?|Grapes?|Region|Country(?: of Origin)?|Producer|Brand)\s*:\s*(.+)$/gim)];
    const kv = new Map<string, string>();
    for (const match of kvMatches) {
        kv.set(match[1].toLowerCase(), normalizeText(match[2]));
    }

    const notesMatch = normalized.match(/(?:^|\n)#{1,6}\s*Tasting Notes?\s*\n([\s\S]*?)(?=\n#{1,6}\s+|$)/i);
    const tastingNotes = notesMatch ? normalizeText(notesMatch[1]) : undefined;
    const type = parseWineType(kv.get("type") ?? title);
    const grapes = uniqueStrings([
        ...splitGrapes(kv.get("varietal")),
        ...splitGrapes(kv.get("varietal blend")),
        ...splitGrapes(kv.get("grape")),
        ...splitGrapes(kv.get("grapes")),
        ...extractGrapesFromText(normalized),
    ]);

    return {
        name: title,
        producer: firstNonEmpty(kv.get("producer"), kv.get("brand"), inferProducerFromTitle(title)),
        vintage: extractYearFromText(title),
        grapes,
        region: firstNonEmpty(kv.get("region")),
        country: firstNonEmpty(kv.get("country"), kv.get("country of origin")),
        type,
        tastingNotes,
    };
};

const buildPromptPageText = (html: string, markdownContent?: string) => {
    const htmlWithoutScript = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ");
    const lower = htmlWithoutScript.toLowerCase();
    const keywords = ["tasting notes", "taste profile", "technical info", "varietal", "region", "country", "productjson"];
    const snippets: string[] = [];
    snippets.push(stripHtml(htmlWithoutScript.slice(0, 2500)));
    for (const keyword of keywords) {
        const index = lower.indexOf(keyword);
        if (index === -1) continue;
        const start = Math.max(0, index - 1200);
        const end = Math.min(htmlWithoutScript.length, index + 2200);
        snippets.push(stripHtml(htmlWithoutScript.slice(start, end)));
    }
    if (markdownContent) {
        snippets.push(stripHtml(markdownContent));
    }
    return uniqueStrings(snippets).join("\n\n").slice(0, 10000);
};

const buildFallbackWineFromHtml = (html: string, pageUrl: string): WineVisionResult | null => {
    const productJson = extractShopifyProductJson(html);
    const jsonLdProduct = extractJsonLdProducts(html)[0];
    const info = extractInfoMap(html);
    const productTags = Array.isArray(productJson?.tags) ? productJson.tags : [];
    const tasteProfile = describeTasteProfile(extractTasteProfileEntries(html));

    const rawTitle = firstNonEmpty(
        productJson?.title,
        typeof jsonLdProduct?.name === "string" ? jsonLdProduct.name : undefined,
        getMetaContent(html, "og:title"),
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    );
    if (!rawTitle) return null;

    const title = rawTitle
        .replace(/\s*[\-|\u2022]\s*(buy|shop|online).*/i, "")
        .replace(/\s*[\-|\u2022]\s*(world wine|dan murphy'?s|vivino|drink fab).*/i, "")
        .trim();
    if (!title) return null;

    const inferredProducer = inferProducerFromTitle(title);
    const brandedProducer = firstNonEmpty(
        info.get("brand"),
        info.get("producer"),
        productJson?.vendor,
        typeof jsonLdProduct?.brand === "string" ? jsonLdProduct.brand : undefined
    );
    const producer = brandedProducer && /^(world wine|drink fab|fab)$/i.test(brandedProducer)
        ? inferredProducer
        : firstNonEmpty(brandedProducer, inferredProducer);
    const type = parseWineType(
        firstNonEmpty(
            info.get("type"),
            productJson?.type,
            typeof jsonLdProduct?.category === "string" ? jsonLdProduct.category : undefined,
            title
        )
    ) ?? inferWineType(
        [
            title,
            getMetaContent(html, "description"),
            getMetaContent(html, "og:description"),
            productJson?.description ? stripHtml(productJson.description) : undefined,
            productJson?.content ? stripHtml(productJson.content) : undefined,
        ].filter(Boolean).join(" ")
    );
    const grapes = uniqueStrings([
        ...splitGrapes(info.get("varietal")),
        ...splitGrapes(info.get("varietal blend")),
        ...splitGrapes(info.get("grape")),
        ...splitGrapes(info.get("grapes")),
        ...productTags.flatMap((tag) => extractGrapesFromText(tag)),
        ...extractGrapesFromText(title),
    ]);
    const tastingNotes = renderTastingNotes(
        firstNonEmpty(
            extractTastingNotesFromHtml(html),
            productJson?.description ? stripHtml(productJson.description) : undefined,
            productJson?.content ? stripHtml(productJson.content) : undefined,
            typeof jsonLdProduct?.description === "string" ? stripHtml(jsonLdProduct.description) : undefined
        ),
        tasteProfile
    );

    return {
        name: title,
        producer,
        vintage: extractYearFromText(title),
        grapes,
        region: firstNonEmpty(info.get("region"), extractBestRegionFromTags(productTags)),
        country: firstNonEmpty(
            info.get("country"),
            info.get("country of origin"),
            extractBestCountryFromTags(productTags)
        ),
        type,
        imageUrl: toAbsoluteUrl(
            firstNonEmpty(
                getMetaContent(html, "og:image:secure_url"),
                getMetaContent(html, "og:image"),
                productJson?.featured_image,
                productJson?.images?.[0]
            ),
            pageUrl
        ),
        tastingNotes,
        tasteProfile,
    };
};

const WINE_VISION_PROMPT = `You are a wine label reading assistant. Extract wine details from this label photo and return ONLY a JSON object — no markdown, no explanation, just raw JSON:

{
  "name": "Wine name",
  "producer": "Producer or winery name",
  "vintage": 2021,
  "grapes": ["Shiraz", "Grenache"],
  "region": "Barossa Valley",
  "country": "Australia",
  "type": "RED"
}

Rules:
- type must be one of: RED, WHITE, SPARKLING, ROSE, DESSERT, FORTIFIED, OTHER
- vintage is a 4-digit year number, omit if not visible
- grapes is an array of grape variety names, omit if not visible
- Omit any field you cannot read clearly
- Return ONLY the JSON object`;

export async function extractWineFromImageViaGroq(
    base64Image: string,
    mimeType: string
): Promise<WineVisionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!hasUsableApiKey(apiKey)) {
        throw new Error("GROQ_API_KEY is not configured. Set GROQ_API_KEY in your environment.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                        { type: "text", text: WINE_VISION_PROMPT },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 512,
        }),
    });

    if (!response.ok) {
        console.warn("[wine] Groq image extraction failed:", response.status, response.statusText);
        return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    try {
        const cleaned = cleanJsonBlock(content);
        return JSON.parse(cleaned) as WineVisionResult;
    } catch {
        console.warn("[wine] Groq image extraction returned non-JSON content");
        return null;
    }
}

type BottlePriceResult = {
    productId: string;
    url: string;
    price: number;
    source: string;
} | null;

export type StockistResult = {
    source: string;
    price: number;
    url: string;
    fetchedAt: string;
    productName?: string;
    productId?: string;
};

type SerpShoppingResult = {
    stockists: StockistResult[];
    thumbnailUrl: string | null;
};

export type FetchStockistsResult = {
    stockists: StockistResult[];
    bottleImageUrl: string | null;
};

const buildQueryVariants = (wineName: string, producer?: string, vintage?: number) => {
    const producerRaw = (producer ?? "").trim();
    const wineRaw = wineName.trim();
    const wineNoYear = stripLeadingVintage(wineRaw);

    const producerNormalized = normalizeSearchText(producerRaw).toLowerCase();
    const wineNoYearNormalized = normalizeSearchText(wineNoYear).toLowerCase();

    let wineCore = wineNoYear;
    if (producerNormalized && wineNoYearNormalized.startsWith(producerNormalized)) {
        const producerWordCount = producerRaw.split(/\s+/).filter(Boolean).length;
        const words = wineNoYear.split(/\s+/).filter(Boolean);
        wineCore = words.slice(producerWordCount).join(" ").trim() || wineNoYear;
    }
    wineCore = wineCore.replace(/^[\s\-\u2013\u2014·•,;:'"]+/, "").trim() || wineNoYear;

    const producerAscii = normalizeSearchText(producerRaw);
    const wineAscii = normalizeSearchText(wineCore || wineNoYear || wineRaw);
    const wineNoYearAscii = normalizeSearchText(wineNoYear);
    const wineRawAscii = normalizeSearchText(wineRaw);
    const vintageText = vintage?.toString();

    return Array.from(new Set([
        [producerRaw, wineRaw, vintageText].filter(Boolean).join(" ").trim(),
        [producerRaw, wineNoYear, vintageText].filter(Boolean).join(" ").trim(),
        [producerRaw, wineCore, vintageText].filter(Boolean).join(" ").trim(),
        [producerRaw, wineCore].filter(Boolean).join(" ").trim(),
        [wineNoYear, vintageText].filter(Boolean).join(" ").trim(),
        wineNoYear,
        wineRaw,
        [producerAscii, wineAscii, vintageText].filter(Boolean).join(" ").trim(),
        [producerAscii, wineAscii].filter(Boolean).join(" ").trim(),
        [wineAscii, vintageText].filter(Boolean).join(" ").trim(),
        wineAscii,
        wineNoYearAscii,
        wineRawAscii,
    ].filter(Boolean)));
};

const buildSearchQuery = (wineName: string, producer?: string, vintage?: number) =>
    buildQueryVariants(wineName, producer, vintage)[0] ?? [producer, wineName, vintage?.toString()].filter(Boolean).join(" ");

const fetchSerpShopping = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<SerpShoppingResult> => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!hasUsableApiKey(apiKey)) return { stockists: [], thumbnailUrl: null };

    const allVariants = buildQueryVariants(wineName, producer, vintage);
    const queries = [
        wineName,
        ...allVariants.slice(7),
        ...allVariants.slice(2, 7),
    ];

    try {
        for (const query of queries) {
            const url = new URL("https://serpapi.com/search");
            url.searchParams.set("engine", "google_shopping");
            url.searchParams.set("google_domain", "google.com.au");
            url.searchParams.set("location", "Sydney, New South Wales, Australia");
            url.searchParams.set("q", query);
            url.searchParams.set("gl", "au");
            url.searchParams.set("hl", "en");
            url.searchParams.set("num", "10");
            url.searchParams.set("api_key", apiKey);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(8000),
                next: { revalidate: 0 },
            });
            if (!response.ok) {
                console.warn(`[wine] SerpAPI shopping HTTP ${response.status} for query="${query}"`);
                continue;
            }

            const data = await response.json();
            if (typeof data?.error === "string") {
                console.warn(`[wine] SerpAPI shopping error: ${data.error}`);
                continue;
            }

            const results: Array<{
                price?: string;
                extracted_price?: number;
                link?: string;
                product_link?: string;
                product_id?: string;
                source?: string;
                seller?: string;
                merchant?: string;
                store?: string;
                title?: string;
                thumbnail?: string;
                serpapi_thumbnail?: string;
            }> = data.shopping_results ?? [];

            console.info(`[wine] SerpAPI shopping query="${query}" → ${results.length} raw results`);

            const fetchedAt = new Date().toISOString();
            const stockists = results
                .map((result) => {
                    const price = result.extracted_price ?? parsePrice(result.price);
                    const url = result.link ?? result.product_link;
                    if (Number.isNaN(price) || price <= 0 || !url) return null;

                    let source =
                        result.source
                        ?? result.seller
                        ?? result.merchant
                        ?? result.store;
                    if (!source) {
                        try {
                            source = new URL(url).hostname.replace(/^www\./i, "");
                        } catch {
                            source = "Google Shopping";
                        }
                    }

                    const productName = typeof result.title === "string" ? normalizeText(result.title) : undefined;
                    const productId = typeof result.product_id === "string" ? result.product_id : undefined;
                    return {
                        source,
                        price,
                        url,
                        fetchedAt,
                        ...(productName ? { productName } : {}),
                        ...(productId ? { productId } : {}),
                    } satisfies StockistResult;
                })
                .filter((result) => result !== null);

            console.info(`[wine] SerpAPI shopping query="${query}" → ${stockists.length} parsed stockists`);

            if (stockists.length > 0) {
                const thumbnailUrl = results.find((result) => result.serpapi_thumbnail || result.thumbnail)?.serpapi_thumbnail
                    ?? results.find((result) => result.thumbnail)?.thumbnail
                    ?? null;
                return { stockists, thumbnailUrl };
            }
        }
        return { stockists: [], thumbnailUrl: null };
    } catch (error) {
        console.warn("[wine] SerpAPI shopping threw:", error);
        return { stockists: [], thumbnailUrl: null };
    }
};

const fetchSerpOrganic = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<StockistResult[]> => {
    const apiKey = process.env.SERPAPI_KEY;
    if (!hasUsableApiKey(apiKey)) return [];

    const allVariants = buildQueryVariants(wineName, producer, vintage);
    const queries = [
        wineName,
        ...allVariants.slice(7),
        ...allVariants.slice(2, 7),
    ];

    const stockists: StockistResult[] = [];
    try {
        const KNOWN_RETAILERS = [
            { pattern: /thewinecollective\.com\.au/i, name: "The Wine Collective" },
            { pattern: /danmurphys\.com\.au/i, name: "Dan Murphy's" },
            { pattern: /bws\.com\.au/i, name: "BWS" },
            { pattern: /vintagecellars\.com\.au/i, name: "Vintage Cellars" },
            { pattern: /firstchoiceliquor\.com\.au/i, name: "First Choice Liquor" },
            { pattern: /winedepot\.com\.au/i, name: "Wine Depot" },
            { pattern: /winestar\.com\.au/i, name: "Wine Star" },
            { pattern: /grevilleawines\.com\.au/i, name: "Greville & Co Wines" },
            { pattern: /thevinepress\.com\.au/i, name: "The Vine Press" },
            { pattern: /worldwine\.com\.au/i, name: "World Wine" },
        ];

        for (const query of queries) {
            const url = new URL("https://serpapi.com/search");
            url.searchParams.set("engine", "google");
            url.searchParams.set("google_domain", "google.com.au");
            url.searchParams.set("location", "Sydney, New South Wales, Australia");
            url.searchParams.set("q", `${query} buy`);
            url.searchParams.set("gl", "au");
            url.searchParams.set("hl", "en");
            url.searchParams.set("num", "10");
            url.searchParams.set("api_key", apiKey);

            const response = await fetch(url.toString(), {
                signal: AbortSignal.timeout(8000),
                next: { revalidate: 0 },
            });
            if (!response.ok) continue;

            const data = await response.json();
            if (typeof data?.error === "string") continue;
            const inlineProducts: Array<{
                price?: string;
                extracted_price?: number;
                link?: string;
                source?: string;
                title?: string;
            }> = data.inline_shopping?.items ?? data.shopping_results ?? [];
            const organicResults: Array<{ link?: string; snippet?: string }> = data.organic_results ?? [];
            const fetchedAt = new Date().toISOString();

            for (const result of inlineProducts) {
                const price = result.extracted_price ?? parsePrice(result.price);
                if (Number.isNaN(price) || price <= 0 || !result.link || !result.source) continue;
                stockists.push({
                    source: result.source,
                    price,
                    url: result.link,
                    fetchedAt,
                    productName: typeof result.title === "string" ? normalizeText(result.title) : undefined,
                });
            }

            for (const result of organicResults) {
                if (!result.link) continue;
                const retailer = KNOWN_RETAILERS.find((entry) => entry.pattern.test(result.link ?? ""));
                if (!retailer) continue;
                const priceMatch = result.snippet?.match(/(?:AUD\s*|A?\$\s*)([\d,]+(?:\.\d{1,2})?)/i);
                if (!priceMatch) continue;
                const price = parsePrice(priceMatch[1]);
                if (Number.isNaN(price) || price <= 0) continue;
                stockists.push({ source: retailer.name, price, url: result.link, fetchedAt });
            }

            if (stockists.length > 0) break;
        }

        return stockists;
    } catch {
        return [];
    }
};

const fetchVivinoStockists = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<StockistResult[]> => {
    const queries = [
        buildSearchQuery(wineName, producer, vintage),
        [producer, stripLeadingVintage(wineName), vintage?.toString()].filter(Boolean).join(" "),
        stripLeadingVintage(wineName),
    ].filter(Boolean);
    try {
        for (const query of queries) {
            const response = await fetch(
                `https://www.vivino.com/api/explore/explore?q=${encodeURIComponent(query)}&per_page=8`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                        Accept: "application/json",
                        Referer: "https://www.vivino.com/",
                    },
                    signal: AbortSignal.timeout(6000),
                }
            );
            if (!response.ok) continue;

            const data = await response.json();
            const matches: Array<{
                vintage?: { wine?: { id?: number }; year?: number };
                price?: { amount?: number; currency?: string };
            }> = data?.explore_vintage?.matches ?? [];

            const fetchedAt = new Date().toISOString();
            const parsed = matches
                .filter((match) => {
                    if (!match.price?.amount) return false;
                    if (match.price.currency && match.price.currency !== "AUD") return false;
                    if (vintage && match.vintage?.year && match.vintage.year !== vintage) return false;
                    return true;
                })
                .map((match) => ({
                    source: "Vivino",
                    price: Number(match.price!.amount),
                    url: `https://www.vivino.com/wines/${match.vintage?.wine?.id}`,
                    fetchedAt,
                }))
                .slice(0, 1);

            if (parsed.length > 0) return parsed;
        }
        return [];
    } catch {
        return [];
    }
};

const fetchDanMurphysStockist = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<StockistResult[]> => {
    const queries = buildQueryVariants(wineName, producer, vintage);
    const endpoints = [
        "https://www.danmurphys.com.au/product/search",
        "https://www.danmurphys.com.au/dm/product/search",
    ];
    try {
        for (const query of queries) {
            const sanitisedQuery = query
                .replace(/['\u2018\u2019\u201C\u201D"]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            for (const endpoint of endpoints) {
                const response = await fetch(
                    `${endpoint}?searchTerm=${encodeURIComponent(sanitisedQuery)}&pageNumber=1&pageSize=5`,
                    {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                            Accept: "application/json, text/plain, */*",
                            Referer: "https://www.danmurphys.com.au/",
                        },
                        signal: AbortSignal.timeout(6000),
                    }
                );
                if (!response.ok) continue;

                const data = await response.json();
                const products: Array<{
                    slug?: string;
                    id?: string | number;
                    priceValue?: number;
                    prices?: { promoPriceValue?: number; retailerPriceValue?: number };
                }> = data?.products ?? data?.hits ?? data?.results ?? [];

                if (!products.length) continue;
                const best = products[0];
                const price = best.priceValue ?? best.prices?.promoPriceValue ?? best.prices?.retailerPriceValue;
                if (!price) continue;

                const slug = best.slug ?? String(best.id ?? "");
                return [{
                    source: "Dan Murphy's",
                    price: Number(price),
                    url: `https://www.danmurphys.com.au/product/${slug}`,
                    fetchedAt: new Date().toISOString(),
                    productName: typeof (best as { name?: unknown }).name === "string"
                        ? normalizeText((best as { name: string }).name)
                        : undefined,
                }];
            }
        }
        return [];
    } catch {
        return [];
    }
};

const fetchBwsStockist = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<StockistResult[]> => {
    const queries = buildQueryVariants(wineName, producer, vintage);
    try {
        for (const query of queries) {
            const sanitisedQuery = query
                .replace(/['\u2018\u2019\u201C\u201D"]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const response = await fetch(
                `https://api.bws.com.au/apis/ui/product/Search?searchTerm=${encodeURIComponent(sanitisedQuery)}&pageSize=5`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0",
                        Accept: "application/json",
                        Referer: "https://bws.com.au/",
                    },
                    signal: AbortSignal.timeout(6000),
                }
            );
            if (!response.ok) continue;

            const data = await response.json();
            const products: Array<{ stockCode?: string; price?: number; priceValue?: number }> =
                data?.Products ?? data?.products ?? [];

            if (!products.length) continue;
            const best = products[0];
            const price = best.price ?? best.priceValue;
            if (!price) continue;

            return [{
                source: "BWS",
                price: Number(price),
                url: `https://bws.com.au/product/${best.stockCode ?? ""}`,
                fetchedAt: new Date().toISOString(),
                productName: typeof (best as { name?: unknown }).name === "string"
                    ? normalizeText((best as { name: string }).name)
                    : undefined,
            }];
        }
        return [];
    } catch {
        return [];
    }
};

const fetchWineCollectiveStockist = async (
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<StockistResult[]> => {
    const queryVariants = buildQueryVariants(wineName, producer, vintage).slice(0, 6);
    const fetchedAt = new Date().toISOString();
    const wineCollectiveOrigin = "https://www.thewinecollective.com.au";

    const sanitizeProductUrl = (value: string | undefined) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        if (!trimmed || /{{|}}|%7B%7B|%7D%7D/i.test(trimmed)) return undefined;

        try {
            const parsed = new URL(trimmed, wineCollectiveOrigin);
            if (!/thewinecollective\.com\.au$/i.test(parsed.hostname)) return undefined;
            if (!parsed.pathname.startsWith("/products/")) return undefined;
            return `${wineCollectiveOrigin}${parsed.pathname}`;
        } catch {
            return undefined;
        }
    };

    const parseSuggestPrice = (value: unknown) => {
        if (typeof value === "number") {
            if (!Number.isFinite(value) || value <= 0) return NaN;
            return value > 1000 ? value / 100 : value;
        }
        if (typeof value === "string") {
            const parsed = parsePrice(value);
            return Number.isFinite(parsed) ? parsed : NaN;
        }
        return NaN;
    };

    const fetchProductJson = async (handle: string) => {
        const response = await fetch(`${wineCollectiveOrigin}/products/${encodeURIComponent(handle)}.js`, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                Accept: "application/json",
                Referer: `${wineCollectiveOrigin}/`,
            },
            signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) return undefined;

        const data = await response.json() as {
            handle?: string;
            price?: number;
            price_min?: number;
            variants?: Array<{ price?: number }>;
        };

        const cents = data.price_min ?? data.price ?? data.variants?.[0]?.price;
        const price = typeof cents === "number" ? cents / 100 : NaN;
        const canonicalHandle = typeof data.handle === "string" && data.handle.trim()
            ? data.handle.trim()
            : handle;

        if (!Number.isFinite(price) || price <= 0) return undefined;
        return {
            price,
            url: `${wineCollectiveOrigin}/products/${canonicalHandle}`,
        };
    };

    const findBestHandleFromSuggest = (products: Array<{
        handle?: string;
        title?: string;
        url?: string;
        price?: string | number;
        price_min?: string | number;
    }>) => {
        if (!products.length) return undefined;

        const desiredName = normalizeSearchText(stripLeadingVintage(wineName)).toLowerCase();
        const producerName = normalizeSearchText(producer ?? "").toLowerCase();
        const desiredTokens = desiredName.split(" ").filter((token) => token.length >= 3);

        let best:
            | {
                handle: string;
                url: string;
                price: number;
                score: number;
                title?: string;
            }
            | undefined;

        for (const product of products) {
            const fromUrl = sanitizeProductUrl(product.url);
            const handleFromUrl = fromUrl?.match(/\/products\/([^/?#]+)/i)?.[1];
            const handle = product.handle?.trim() || handleFromUrl;
            if (!handle) continue;

            const url = fromUrl ?? `${wineCollectiveOrigin}/products/${handle}`;
            const price = parseSuggestPrice(product.price_min ?? product.price);
            if (!Number.isFinite(price) || price <= 0) continue;

            const title = normalizeSearchText(product.title ?? "").toLowerCase();
            const titleTokens = new Set(title.split(" ").filter(Boolean));
            let score = 0;

            if (title && desiredName && title.includes(desiredName)) score += 40;
            if (title && producerName && title.includes(producerName)) score += 20;
            if (vintage && title.includes(String(vintage))) score += 10;
            score += desiredTokens.reduce((acc, token) => acc + (titleTokens.has(token) ? 1 : 0), 0);

            if (!best || score > best.score) {
                best = {
                    handle,
                    url,
                    price,
                    score,
                    title: product.title ? normalizeText(product.title) : undefined,
                };
            }
        }

        return best;
    };

    try {
        for (const query of queryVariants) {
            const shopifyQuery = query
                .replace(/['\u2018\u2019\u201C\u201D"]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            const suggestUrl = new URL(`${wineCollectiveOrigin}/search/suggest.json`);
            suggestUrl.searchParams.set("q", shopifyQuery);
            suggestUrl.searchParams.set("resources[type]", "product");
            suggestUrl.searchParams.set("resources[limit]", "8");
            suggestUrl.searchParams.set("resources[options][unavailable_products]", "last");
            suggestUrl.searchParams.set("resources[options][fields]", "title,product_type,variants.title,vendor,tag");

            const suggestResponse = await fetch(suggestUrl.toString(), {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    Accept: "application/json",
                    Referer: `${wineCollectiveOrigin}/`,
                },
                signal: AbortSignal.timeout(7000),
            });
            if (!suggestResponse.ok) continue;

            const suggestData = await suggestResponse.json() as {
                resources?: {
                    results?: {
                        products?: Array<{
                            handle?: string;
                            title?: string;
                            url?: string;
                            price?: string | number;
                            price_min?: string | number;
                        }>;
                    };
                };
            };

            const products = suggestData?.resources?.results?.products ?? [];
            const best = findBestHandleFromSuggest(products);
            if (!best) continue;

            const precise = await fetchProductJson(best.handle);
            if (precise) {
                return [{
                    source: "The Wine Collective",
                    price: precise.price,
                    url: precise.url,
                    fetchedAt,
                    productName: best.title ?? titleFromHandle(best.handle),
                }];
            }

            return [{
                source: "The Wine Collective",
                price: best.price,
                url: best.url,
                fetchedAt,
                productName: best.title ?? titleFromHandle(best.handle),
            }];
        }

        return [];
    } catch {
        return [];
    }
};

export async function fetchAllStockists(
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<FetchStockistsResult> {
    const queryVariants = buildQueryVariants(wineName, producer, vintage);
    const [serpShoppingResult, serpOrganic, vivino, danMurphys, bws, wineCollective] = await Promise.all([
        fetchSerpShopping(wineName, producer, vintage),
        fetchSerpOrganic(wineName, producer, vintage),
        fetchVivinoStockists(wineName, producer, vintage),
        fetchDanMurphysStockist(wineName, producer, vintage),
        fetchBwsStockist(wineName, producer, vintage),
        fetchWineCollectiveStockist(wineName, producer, vintage),
    ]);

    const all = [...serpShoppingResult.stockists, ...serpOrganic, ...vivino, ...danMurphys, ...bws, ...wineCollective];
    const bySource = new Map<string, StockistResult>();
    for (const result of all) {
        const key = result.source.toLowerCase().trim();
        const existing = bySource.get(key);
        if (!existing || result.price < existing.price) {
            bySource.set(key, result);
        }
    }

    const deduped = Array.from(bySource.values()).sort((a, b) => a.price - b.price);
    console.info(
        `[wine] stockist results for "${wineName}" (${producer ?? "unknown producer"}, ${vintage ?? "nv"}): `
        + `shopping=${serpShoppingResult.stockists.length} organic=${serpOrganic.length} `
        + `vivino=${vivino.length} dm=${danMurphys.length} bws=${bws.length} wc=${wineCollective.length} total=${deduped.length}`
    );
    if (deduped.length === 0) {
        console.info(`[wine] query variants tried: ${queryVariants.join(" | ")}`);
    }
    return {
        stockists: deduped,
        bottleImageUrl: serpShoppingResult.thumbnailUrl,
    };
}

export async function fetchBottlePrice(
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<BottlePriceResult> {
    if (!hasUsableApiKey(process.env.SERPAPI_KEY)) {
        return null;
    }

    const { stockists } = await fetchAllStockists(wineName, producer, vintage);
    if (!stockists.length) return null;

    const best =
        stockists.find((stockist) => stockist.source.toLowerCase().includes("dan murphy")) ?? stockists[0];
    return {
        productId: best.productId ?? best.url,
        url: best.url,
        price: best.price,
        source: best.source,
    };
}

export async function extractWineFromUrlViaGroq(url: string): Promise<WineVisionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;
    let html = "";
    let markdownContent: string | undefined;
    let markdownTitle: string | undefined;

    try {
        const [markdownResult, htmlResult] = await Promise.all([
            fetchMarkdownFromUrl(url),
            fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-AU,en;q=0.9",
                },
                cache: "no-store",
                signal: AbortSignal.timeout(10000),
            }),
        ]);

        if (markdownResult?.content) {
            markdownContent = markdownResult.content;
            markdownTitle = markdownResult.title;
        }

        if (!htmlResult.ok) {
            console.warn("[wine] URL fetch failed:", htmlResult.status, htmlResult.statusText, url);
            return extractWineCandidateFromMarkdown(markdownContent ?? "", markdownTitle);
        }
        html = await htmlResult.text();
    } catch (error) {
        console.warn("[wine] URL fetch threw an error:", error);
        return extractWineCandidateFromMarkdown(markdownContent ?? "", markdownTitle);
    }

    const markdownCandidate = markdownContent
        ? extractWineCandidateFromMarkdown(markdownContent, markdownTitle)
        : null;
    const htmlCandidate = buildFallbackWineFromHtml(html, url);
    const bestDeterministicCandidate = selectBestWineCandidate([markdownCandidate, htmlCandidate]);

    const pageText = buildPromptPageText(html, markdownContent);
    if (!pageText) return bestDeterministicCandidate;
    if (!hasUsableApiKey(apiKey)) {
        if (!bestDeterministicCandidate) {
            console.warn("[wine] GROQ_API_KEY is not configured and fallback extraction did not find wine metadata.");
        }
        return bestDeterministicCandidate;
    }

    const prompt = `Extract wine details from this webpage text and return ONLY a JSON object — no markdown, no explanation:

{
  "name": "Wine name",
  "producer": "Producer or winery",
  "vintage": 2021,
  "grapes": ["Shiraz"],
  "region": "Barossa Valley",
  "country": "Australia",
  "type": "RED",
  "tastingNotes": "Short tasting notes from the page",
  "tasteProfile": ["Body: Light (25%)", "Acidity: 75%"]
}

type must be one of: RED, WHITE, SPARKLING, ROSE, DESSERT, FORTIFIED, OTHER
Only include fields present in the page context. Do not hallucinate.
Return ONLY the JSON.

Webpage text:
${pageText}`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // text model — faster + cheaper than vision for URL extraction
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 512,
            }),
        });

        if (!response.ok) {
            console.warn("[wine] Groq URL extraction failed:", response.status, response.statusText);
            return bestDeterministicCandidate;
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return bestDeterministicCandidate;

        const cleaned = cleanJsonBlock(content);
        const result = JSON.parse(cleaned) as WineVisionResult;
        const normalizedTasteProfile = uniqueStrings(result.tasteProfile ?? []);
        const merged: WineVisionResult = {
            ...bestDeterministicCandidate,
            ...result,
            grapes: uniqueStrings([...(bestDeterministicCandidate?.grapes ?? []), ...(result.grapes ?? [])]),
            tasteProfile: uniqueStrings([...(bestDeterministicCandidate?.tasteProfile ?? []), ...normalizedTasteProfile]),
            tastingNotes: renderTastingNotes(
                firstNonEmpty(result.tastingNotes, bestDeterministicCandidate?.tastingNotes),
                uniqueStrings([...(bestDeterministicCandidate?.tasteProfile ?? []), ...normalizedTasteProfile])
            ),
            imageUrl: toAbsoluteUrl(result.imageUrl ?? bestDeterministicCandidate?.imageUrl, url),
            name: firstNonEmpty(result.name, bestDeterministicCandidate?.name) ?? "",
            type: parseWineType(result.type) ?? bestDeterministicCandidate?.type,
            vintage: result.vintage ?? bestDeterministicCandidate?.vintage,
            producer: firstNonEmpty(result.producer, bestDeterministicCandidate?.producer),
            region: firstNonEmpty(result.region, bestDeterministicCandidate?.region),
            country: firstNonEmpty(result.country, bestDeterministicCandidate?.country),
        };
        return merged.name ? merged : bestDeterministicCandidate;
    } catch (error) {
        console.warn("[wine] Groq URL extraction response parse failed:", error);
        return bestDeterministicCandidate;
    }
}

export async function extractWineFromNameViaGroq(name: string): Promise<WineVisionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!hasUsableApiKey(apiKey)) return null;

    const prompt = `Given only the wine name "${name}", infer what you can about this wine and return ONLY a JSON object — no markdown, no explanation:

{
  "name": "Cleaned wine name without vintage",
  "producer": "Producer or winery name",
  "vintage": 2022,
  "grapes": ["Gamay"],
  "region": "Beaujolais",
  "country": "France",
  "type": "RED"
}

Rules:
- type must be one of: RED, WHITE, SPARKLING, ROSE, DESSERT, FORTIFIED, OTHER
- vintage is a 4-digit year number, omit if not in the name
- Only include fields you're reasonably confident about from the name alone
- Do not hallucinate obscure details — omit rather than guess
- Return ONLY the JSON object`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 256,
            }),
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return null;

        const cleaned = cleanJsonBlock(content);
        return JSON.parse(cleaned) as WineVisionResult;
    } catch {
        return null;
    }
}
