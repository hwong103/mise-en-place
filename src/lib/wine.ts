export type WineVisionResult = {
    name: string;
    producer?: string;
    vintage?: number;
    grapes?: string[];
    region?: string;
    country?: string;
    type?: "RED" | "WHITE" | "SPARKLING" | "ROSE" | "DESSERT" | "FORTIFIED" | "OTHER";
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

type DanMurphysResult = {
    productId: string;
    url: string;
    price: number;
} | null;

export async function fetchDanMurphysPrice(wineName: string, producer?: string): Promise<DanMurphysResult> {
    const query = encodeURIComponent([producer, wineName].filter(Boolean).join(" "));

    try {
        // Dan Murphy's search API (public endpoint, no auth required)
        const response = await fetch(
            `https://api.danmurphys.com.au/apis/ui/v1/product/search?q=${query}&pageSize=1`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    Accept: "application/json",
                },
                next: { revalidate: 0 },
            }
        );

        if (!response.ok) return null;

        const data = await response.json();
        const product = data?.hits?.[0];
        if (!product) return null;

        const price =
            product.priceValue ??
            product.prices?.promoPriceValue ??
            product.prices?.retailerPriceValue;

        if (!price) return null;

        return {
            productId: String(product.id ?? product.productId ?? ""),
            url: `https://www.danmurphys.com.au/product/${product.id}`,
            price: Number(price),
        };
    } catch {
        return null;
    }
}
