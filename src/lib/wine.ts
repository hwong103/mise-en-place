export type WineVisionResult = {
    name: string;
    producer?: string;
    vintage?: number;
    grapes?: string[];
    region?: string;
    country?: string;
    type?: "RED" | "WHITE" | "SPARKLING" | "ROSE" | "DESSERT" | "FORTIFIED" | "OTHER";
    imageUrl?: string;
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
    return producerMatch?.[1]?.trim();
};

const buildFallbackWineFromHtml = (html: string, pageUrl: string): WineVisionResult | null => {
    const rawTitle = getMetaContent(html, "og:title")
        ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const siteName = getMetaContent(html, "og:site_name");
    if (!rawTitle) return null;

    const title = rawTitle
        .replace(/\s*[\-|\u2022]\s*(buy|shop|online).*/i, "")
        .replace(/\s*[\-|\u2022]\s*(world wine|dan murphy'?s|vivino).*/i, "")
        .trim();
    if (!title) return null;

    const yearMatch = title.match(/\b(19|20)\d{2}\b/);
    const type = inferWineType(
        [title, getMetaContent(html, "description"), getMetaContent(html, "og:description")].filter(Boolean).join(" ")
    );
    const producer = inferProducerFromTitle(title);
    const image = getMetaContent(html, "og:image:secure_url") ?? getMetaContent(html, "og:image");

    const result: WineVisionResult = {
        name: title,
        ...(producer ? { producer } : {}),
        ...(yearMatch ? { vintage: Number(yearMatch[0]) } : {}),
        ...(type ? { type } : {}),
        ...(siteName && !/world wine/i.test(siteName) ? { producer: producer ?? siteName } : {}),
    };

    if (image) {
        try {
            result.imageUrl = new URL(image, pageUrl).toString();
        } catch {
            result.imageUrl = image;
        }
    }

    return result;
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

export async function fetchBottlePrice(
    wineName: string,
    producer?: string,
    vintage?: number
): Promise<BottlePriceResult> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!hasUsableApiKey(apiKey)) {
        console.warn("[wine] SERPAPI_KEY is not configured. Price fetch skipped.");
        return null;
    }

    const baseQuery = [producer, wineName, vintage?.toString()].filter(Boolean).join(" ").trim();
    const fallbackQuery = [wineName, vintage?.toString()].filter(Boolean).join(" ").trim();
    const queries = Array.from(new Set([
        `${baseQuery} Dan Murphy's`,
        `${fallbackQuery} Dan Murphy's`,
        `${baseQuery} Australia`,
        baseQuery,
        fallbackQuery,
    ].filter(Boolean)));

    try {
        for (const query of queries) {
            const url = new URL("https://serpapi.com/search");
            url.searchParams.set("engine", "google_shopping");
            url.searchParams.set("q", query);
            url.searchParams.set("gl", "au");
            url.searchParams.set("hl", "en");
            url.searchParams.set("num", "8");
            url.searchParams.set("api_key", apiKey);

            const response = await fetch(url.toString(), { next: { revalidate: 0 } });
            if (!response.ok) {
                console.warn("[wine] SERPAPI request failed:", response.status, response.statusText, `query="${query}"`);
                continue;
            }

            const data = await response.json();
            const results: Array<{
                title: string;
                price: string;
                extracted_price?: number;
                link: string;
                source: string;
                product_id?: string;
            }> = data.shopping_results ?? [];
            if (results.length === 0) continue;

            const sortedResults = [...results].sort((a, b) => {
                const aDm = /dan\s*murphy/i.test(a.source ?? "") || /danmurphys\.com\.au/i.test(a.link ?? "");
                const bDm = /dan\s*murphy/i.test(b.source ?? "") || /danmurphys\.com\.au/i.test(b.link ?? "");
                return Number(bDm) - Number(aDm);
            });

            for (const result of sortedResults) {
                const price = result.extracted_price ?? parsePrice(result.price);
                if (Number.isNaN(price) || price <= 0) continue;
                return {
                    productId: result.product_id ?? result.link,
                    url: result.link,
                    price,
                    source: result.source ?? "Unknown",
                };
            }
        }

        console.info(`[wine] No shopping price found for "${baseQuery}"`);
        return null;
    } catch (error) {
        console.error("[wine] Price fetch crashed:", error);
        return null;
    }
}

export async function extractWineFromUrlViaGroq(url: string): Promise<WineVisionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;

    // Fetch the page text
    let pageText = "";
    let html = "";

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-AU,en;q=0.9",
            },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
            console.warn("[wine] URL fetch failed:", response.status, response.statusText, url);
            return null;
        }
        html = await response.text();

        // Strip tags, collapse whitespace, truncate to ~4000 chars for the prompt
        pageText = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 4000);
    } catch (error) {
        console.warn("[wine] URL fetch threw an error:", error);
        return null;
    }

    const fallback = buildFallbackWineFromHtml(html, url);
    if (!pageText) return fallback;
    if (!hasUsableApiKey(apiKey)) {
        if (!fallback) {
            console.warn("[wine] GROQ_API_KEY is not configured and fallback extraction did not find wine metadata.");
        }
        return fallback;
    }

    const prompt = `Extract wine details from this webpage text and return ONLY a JSON object — no markdown, no explanation:

{
  "name": "Wine name",
  "producer": "Producer or winery",
  "vintage": 2021,
  "grapes": ["Shiraz"],
  "region": "Barossa Valley",
  "country": "Australia",
  "type": "RED"
}

type must be one of: RED, WHITE, SPARKLING, ROSE, DESSERT, FORTIFIED, OTHER
Omit any field you cannot find. Return ONLY the JSON.

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
            return fallback;
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return fallback;

        const cleaned = cleanJsonBlock(content);
        const result = JSON.parse(cleaned) as WineVisionResult;
        const merged = {
            ...fallback,
            ...result,
            imageUrl: result.imageUrl ?? fallback?.imageUrl,
            name: result.name?.trim() || fallback?.name || "",
        };
        return merged.name ? merged : fallback;
    } catch (error) {
        console.warn("[wine] Groq URL extraction response parse failed:", error);
        return fallback;
    }
}
