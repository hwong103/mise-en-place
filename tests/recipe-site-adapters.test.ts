import { applyRecipeSiteAdapters } from "@/lib/recipe-site-adapters";

describe("applyRecipeSiteAdapters", () => {
  it("adds Recipe JSON-LD for Cabagges recipe pages", () => {
    const html = `
      <html>
        <body>
          <div id="recipe-intro">
            <h1>Big Steak Pepper Lunch</h1>
            <div class="text-large"><p>Inspired by the <a href="https://example.com">iconic franchise</a>.</p></div>
            <span>35 mins</span>
            <span>Serves 2</span>
            <a href="/recipes?category=Dinner">Dinner<!-- -->, </a>
            <a href="/recipes?category=Popular">Popular</a>
          </div>
          <div id="recipe-ingredients">
            <button><span>View as&nbsp;</span><span>list</span></button>
            <div><div><img alt="" /></div><div>1/2 medium onion</div></div></div>
            <div><div><img alt="" /></div><div>3 garlic cloves</div></div></div>
          </div>
          <div id="recipe-method">
            <a href="https://www.instagram.com/reel/Cz2mRqbtWy3/">Watch Video</a>
            <ul class="instructions__list">
              <li>Wash &amp; cook the rice.</li>
              <li>Fry garlic in neutral oil.</li>
            </ul>
          </div>
          <div id="related-recipes"></div>
        </body>
      </html>
    `;

    const result = applyRecipeSiteAdapters("https://cabagges.world/recipes/big-steak-pepper-lunch", html);
    const json = result.html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];

    expect(result.adapter).toBe("cabagges-json-ld");
    expect(json).toBeTruthy();

    const recipe = JSON.parse(json ?? "{}");
    expect(recipe).toMatchObject({
      "@type": "Recipe",
      name: "Big Steak Pepper Lunch",
      description: "Inspired by the iconic franchise.",
      keywords: "Dinner, Popular",
      recipeYield: "2",
      cookTime: "PT35M",
      recipeIngredient: ["1/2 medium onion", "3 garlic cloves"],
    });
    expect(recipe.recipeInstructions).toEqual([
      { "@type": "HowToStep", text: "Wash & cook the rice." },
      { "@type": "HowToStep", text: "Fry garlic in neutral oil." },
    ]);
    expect(recipe.video.contentUrl).toBe("https://www.instagram.com/reel/Cz2mRqbtWy3/");
  });
});
