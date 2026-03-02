import { extractWineFromUrlViaGroq, fetchBottlePrice } from "@/lib/wine";

describe("wine helpers", () => {
    const originalFetch = global.fetch;
    const originalGroq = process.env.GROQ_API_KEY;
    const originalSerp = process.env.SERPAPI_KEY;

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.GROQ_API_KEY = originalGroq;
        process.env.SERPAPI_KEY = originalSerp;
        vi.restoreAllMocks();
    });

    it("extracts wine details from page metadata when Groq is not configured", async () => {
        process.env.GROQ_API_KEY = "your_key_here";
        global.fetch = vi.fn().mockResolvedValue(
            new Response(
                `<!doctype html>
                <html><head>
                <meta property="og:title" content="Domaine de la Madone Beaujolais BIO 2021" />
                <meta property="og:image" content="/cdn/shop/files/madone.jpg" />
                <meta property="og:description" content="Medium-bodied red wine from Beaujolais." />
                </head><body>product page</body></html>`,
                { status: 200, headers: { "content-type": "text/html" } }
            )
        ) as typeof fetch;

        const parsed = await extractWineFromUrlViaGroq(
            "https://worldwine.com.au/products/domaine-de-la-madone-beaujolais-bio-2021"
        );

        expect(parsed).toEqual(
            expect.objectContaining({
                name: "Domaine de la Madone Beaujolais BIO 2021",
                producer: "Domaine de la Madone",
                vintage: 2021,
                type: "RED",
                imageUrl: "https://worldwine.com.au/cdn/shop/files/madone.jpg",
            })
        );
    });

    it("returns null and skips network when SERPAPI key is placeholder", async () => {
        process.env.SERPAPI_KEY = "your_key_here";
        const fetchSpy = vi.fn();
        global.fetch = fetchSpy as typeof fetch;

        const result = await fetchBottlePrice("Wine Name", "Producer", 2021);
        expect(result).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("prioritizes Dan Murphy shopping results when available", async () => {
        process.env.SERPAPI_KEY = "real-serp-key";
        global.fetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    shopping_results: [
                        {
                            title: "Domaine de la Madone Beaujolais BIO 2021",
                            price: "$39.99",
                            link: "https://example.com/product",
                            source: "Some Store",
                        },
                        {
                            title: "Domaine de la Madone Beaujolais BIO 2021",
                            extracted_price: 40.27,
                            link: "https://www.danmurphys.com.au/product/DM_123",
                            source: "Dan Murphy's",
                            product_id: "DM_123",
                        },
                    ],
                }),
                { status: 200, headers: { "content-type": "application/json" } }
            )
        ) as typeof fetch;

        const result = await fetchBottlePrice("Beaujolais BIO", "Domaine de la Madone", 2021);
        expect(result).toEqual({
            productId: "DM_123",
            url: "https://www.danmurphys.com.au/product/DM_123",
            price: 40.27,
            source: "Dan Murphy's",
        });
    });
});
