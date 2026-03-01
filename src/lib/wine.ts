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
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

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

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    try {
        const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        return JSON.parse(cleaned) as WineVisionResult;
    } catch {
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
    if (!apiKey) return null;

    const query = [producer, wineName, vintage?.toString()]
        .filter(Boolean)
        .join(" ");

    try {
        const url = new URL("https://serpapi.com/search");
        url.searchParams.set("engine", "google_shopping");
        url.searchParams.set("q", query);
        url.searchParams.set("gl", "au");
        url.searchParams.set("hl", "en");
        url.searchParams.set("num", "5");
        url.searchParams.set("api_key", apiKey);

        const response = await fetch(url.toString(), {
            next: { revalidate: 0 },
        });

        if (!response.ok) return null;

        const data = await response.json();
        const results: Array<{
            title: string;
            price: string;
            link: string;
            source: string;
            product_id?: string;
        }> = data.shopping_results ?? [];

        if (results.length === 0) return null;

        for (const result of results) {
            const priceMatch = result.price?.replace(/[^0-9.]/g, "");
            const price = priceMatch ? Number(priceMatch) : NaN;
            if (!isNaN(price) && price > 0) {
                return {
                    productId: result.product_id ?? result.link,
                    url: result.link,
                    price,
                    source: result.source ?? "Unknown",
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

export async function extractWineFromUrlViaGroq(url: string): Promise<WineVisionResult | null> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    // Fetch the page text
    let pageText = "";
    let scrapedImageUrl: string | undefined;

    try {
        const response = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        const html = await response.text();

        // Extract the best image URL from the page
        try {
            const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
            if (ogMatch?.[1]) {
                scrapedImageUrl = ogMatch[1];
            }

            if (!scrapedImageUrl) {
                const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
                for (const match of imgMatches) {
                    const src = match[1];
                    if (
                        src.startsWith("http") &&
                        (src.includes("product") || src.includes("wine") || src.includes("bottle")) &&
                        !src.includes("icon") &&
                        !src.includes("logo") &&
                        !src.includes("badge")
                    ) {
                        scrapedImageUrl = src;
                        break;
                    }
                }
            }

            if (scrapedImageUrl && !scrapedImageUrl.startsWith("http")) {
                const base = new URL(url);
                scrapedImageUrl = new URL(scrapedImageUrl, base.origin).toString();
            }
        } catch { /* silent fail */ }

        // Strip tags, collapse whitespace, truncate to ~4000 chars for the prompt
        pageText = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 4000);
    } catch {
        return null;
    }

    if (!pageText) return null;

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

        if (!response.ok) return null;
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) return null;

        const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const result = JSON.parse(cleaned) as WineVisionResult;
        if (scrapedImageUrl) result.imageUrl = scrapedImageUrl;
        return result;
    } catch {
        return null;
    }
}
