import { extractRecipeFromReadability } from "@/lib/recipe-readability";

describe("extractRecipeFromReadability", () => {
  it("extracts ingredients and instructions from noisy content", () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Weeknight Tomato Pasta</h1>
            <p>This is the easiest pasta.</p>
            <h2>Ingredients</h2>
            <ul>
              <li>1 lb pasta</li>
              <li>2 cups tomato sauce</li>
              <li>1 tbsp olive oil</li>
            </ul>
            <div class="ad">BUY NOW</div>
            <h2>Instructions</h2>
            <ol>
              <li>Boil pasta until tender.</li>
              <li>Heat sauce and combine with pasta.</li>
              <li>Serve immediately.</li>
            </ol>
          </article>
        </body>
      </html>
    `;

    const parsed = extractRecipeFromReadability(html, "https://example.com/recipe");

    expect(parsed).not.toBeNull();
    expect(parsed?.ingredients.length).toBeGreaterThanOrEqual(2);
    expect(parsed?.instructions.length).toBeGreaterThanOrEqual(2);
  });
});
