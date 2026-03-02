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
        global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("markdown.new")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ success: false }), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    })
                );
            }
            return Promise.resolve(
                new Response(
                    `<!doctype html>
                    <html><head>
                    <meta property="og:title" content="Domaine de la Madone Beaujolais BIO 2021" />
                    <meta property="og:image" content="/cdn/shop/files/madone.jpg" />
                    <meta property="og:description" content="Medium-bodied red wine from Beaujolais." />
                    </head><body>product page</body></html>`,
                    { status: 200, headers: { "content-type": "text/html" } }
                )
            );
        }) as typeof fetch;

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

    it("extracts tasting notes, taste profile, and technical wine fields from Shopify product markup", async () => {
        process.env.GROQ_API_KEY = "your_key_here";
        global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("markdown.new")) {
                return Promise.resolve(
                    new Response(JSON.stringify({ success: false }), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    })
                );
            }
            return Promise.resolve(
                new Response(
                    `<!doctype html>
                    <html>
                    <head>
                    <meta property="og:title" content="Domaine de la Madone - Beaujolais-Villages 'Madone BIO' 2022" />
                    <meta property="og:image" content="//drinkfab.com.au/cdn/shop/files/madone.jpg" />
                    </head>
                    <body>
                    <div class="weboost_info_list_ver">
                      <p class="weboost_info_p"><span class="weboost_info_span">Type:</span><span class="weboost_info_span_value">Red</span></p>
                      <p class="weboost_info_p"><span class="weboost_info_span">Varietal:</span><span class="weboost_info_span_value">Gamay Noir</span></p>
                      <p class="weboost_info_p"><span class="weboost_info_span">Varietal Blend:</span><span class="weboost_info_span_value">Gamay</span></p>
                      <p class="weboost_info_p"><span class="weboost_info_span">Region:</span><span class="weboost_info_span_value">Burgundy</span></p>
                      <p class="weboost_info_p"><span class="weboost_info_span">Country:</span><span class="weboost_info_span_value">France</span></p>
                    </div>
                    <p class="weboost_info_p weboost_product_overview">Ripe cherry aromas and a juicy palate.</p>
                    <div class="weboost_process_title_section">
                      <p class="weboost_process_title">Light</p>
                      <p class="weboost_process_title">Full Body</p>
                    </div>
                    <div class="process"><div class="process-bar" style="width: 25%"></div></div>
                    <div class="weboost_process_title_section">
                      <p class="weboost_process_title">Dry</p>
                      <p class="weboost_process_title">Sweet</p>
                    </div>
                    <div class="process"><div class="process-bar" style="width: 25%"></div></div>
                    <div class="weboost_process_title_section">
                      <p class="weboost_process_title">Acidity</p>
                    </div>
                    <div class="process"><div class="process-bar" style="width: 75%"></div></div>
                    <script type="application/json" id="ProductJson-template">
                    {
                      "title":"Domaine de la Madone - Beaujolais-Villages 'Madone BIO' 2022",
                      "vendor":"Fab",
                      "type":"Red",
                      "tags":["France","Burgundy","Gamay","Red"]
                    }
                    </script>
                    </body>
                    </html>`,
                    { status: 200, headers: { "content-type": "text/html" } }
                )
            );
        }) as typeof fetch;

        const parsed = await extractWineFromUrlViaGroq(
            "https://drinkfab.com.au/products/domaine-de-la-madone-beaujolais-villages-madone-bio-2021"
        );

        expect(parsed).toEqual(
            expect.objectContaining({
                name: "Domaine de la Madone - Beaujolais-Villages 'Madone BIO' 2022",
                producer: "Domaine de la Madone",
                vintage: 2022,
                type: "RED",
                grapes: expect.arrayContaining(["Gamay"]),
                region: "Burgundy",
                country: "France",
                imageUrl: "https://drinkfab.com.au/cdn/shop/files/madone.jpg",
            })
        );
        expect(parsed?.tastingNotes).toContain("Ripe cherry aromas and a juicy palate.");
        expect(parsed?.tastingNotes).toContain("Taste Profile:");
        expect(parsed?.tastingNotes).toContain("Body: Light (25%)");
        expect(parsed?.tastingNotes).toContain("Sweetness: Dry (25%)");
        expect(parsed?.tastingNotes).toContain("Acidity: 75%");
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
