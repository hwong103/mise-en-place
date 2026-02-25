import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import {
  fetchRenderedRecipeCandidate,
  isRenderFallbackEnabled,
} from "@/lib/recipe-render-worker-client";
import { importRecipeFromUrl } from "@/app/(dashboard)/recipes/actions";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/household", () => ({
  getCurrentHouseholdId: vi.fn(),
}));

vi.mock("@/lib/recipe-render-worker-client", () => ({
  fetchRenderedRecipeCandidate: vi.fn(),
  isRenderFallbackEnabled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

const buildFormData = (sourceUrl: string) => {
  const formData = new FormData();
  formData.set("sourceUrl", sourceUrl);
  return formData;
};

const withRedirect = async (action: () => Promise<void>) => {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

describe("importRecipeFromUrl ingestion stages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getCurrentHouseholdId).mockResolvedValue("household_1");
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([]);
    vi.mocked(prisma.recipe.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recipe.create).mockResolvedValue({ id: "recipe_1" } as never);
    vi.mocked(isRenderFallbackEnabled).mockReturnValue(false);
    vi.mocked(fetchRenderedRecipeCandidate).mockResolvedValue(null);
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  it("short-circuits fallback when markdown stage is high confidence", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        title: "Fast Pasta",
        content: `---
image: https://cdn.example.com/fast-pasta.jpg
video: https://youtu.be/abc123xyz00
---

# Fast Pasta

Ingredients
${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}

Instructions
${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}`,
      }),
    } as Response);

    const redirected = await withRedirect(() => importRecipeFromUrl(buildFormData("https://example.com/r")));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(createArg?.data.imageUrl).toBe("https://cdn.example.com/fast-pasta.jpg");
    expect(createArg?.data.videoUrl).toBe("https://youtu.be/abc123xyz00");
    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("hydrates image and video from direct HTML when markdown is high confidence but media is missing", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Media Rescue Pasta",
          content: `# Media Rescue Pasta\n\nIngredients\n${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}\n\nInstructions\n${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:image" content="https://cdn.example.com/media-rescue.jpg" />
              <meta property="og:video" content="https://youtu.be/media1234567" />
            </head>
            <script type="application/ld+json">
              {
                "@context":"https://schema.org",
                "@type":"Recipe",
                "name":"Media Rescue Pasta",
                "keywords":"weeknight, pasta",
                "prepTime":"PT12M",
                "cookTime":"PT18M",
                "recipeYield":["4","4 - 5 people"],
                "recipeIngredient":["1 cup flour","1 tsp salt","1 tbsp oil","2 eggs"],
                "recipeInstructions":["Mix","Cook"]
              }
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/media-rescue"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(createArg?.data.tags).toEqual(["weeknight", "pasta"]);
    expect(createArg?.data.prepTime).toBe(12);
    expect(createArg?.data.cookTime).toBe(18);
    expect(createArg?.data.servings).toBe(4);
    expect(createArg?.data.ingredients).toHaveLength(12);
    expect(createArg?.data.imageUrl).toBe("https://cdn.example.com/media-rescue.jpg");
    expect(createArg?.data.videoUrl).toBe("https://youtu.be/media1234567");
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("extracts recipe data from embedded markdown JSON blocks used by bonappetit", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        title: "Slow-Roast Gochujang Chicken",
        content: `---
description: This isn’t the crisp-skinned, high-heat-roast chicken you’re probably familiar with.
image: https://assets.bonappetit.com/photos/5d7296eec4af4d0008ad1263/16:9/w_1280,c_limit/Basically-Gojuchang-Chicken-Recipe-Wide.jpg
title: Slow-Roast Gochujang Chicken
---

ArrowJump To RecipePrint

\`\`\`json
{
  "@context":"http://schema.org",
  "@type":"Recipe",
  "name":"Slow-Roast Gochujang Chicken",
  "keywords":["korean","chicken","weeknight meals"],
  "recipeYield":"4 servings",
  "recipeIngredient":[
    "1 3½–4-lb. whole chicken",
    "1 Tbsp. kosher salt",
    "Freshly ground black pepper",
    "5 Tbsp. gochujang",
    "1/4 cup olive oil",
    "2 heads of garlic"
  ],
  "recipeInstructions":[
    {"@type":"HowToStep","text":"Preheat oven to 300° and season chicken."},
    {"@type":"HowToStep","text":"Whisk gochujang with olive oil and aromatics."},
    {"@type":"HowToStep","text":"Roast until chicken is tender and potatoes are soft."}
  ]
}
\`\`\`
`,
      }),
    } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://www.bonappetit.com/recipe/slow-roast-gochujang-chicken"))
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(createArg?.data.title).toBe("Slow-Roast Gochujang Chicken");
    expect(createArg?.data.tags).toEqual(["korean", "chicken", "weeknight meals"]);
    expect(createArg?.data.servings).toBe(4);
    expect(createArg?.data.ingredients).toHaveLength(6);
    expect(createArg?.data.instructions).toHaveLength(3);
    expect(createArg?.data.imageUrl).toBe(
      "https://assets.bonappetit.com/photos/5d7296eec4af4d0008ad1263/16:9/w_1280,c_limit/Basically-Gojuchang-Chicken-Recipe-Wide.jpg"
    );
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("handles pressurecookrecipes markdown recipe cards and strips trailing metadata lines", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Instant Pot HK Beef Curry",
          content: `---
description: Easy to Make Classic Instant Pot HK Beef Curry (咖喱牛腩) with simple ingredients.
image: https://www.pressurecookrecipes.com/wp-content/uploads/2018/09/instant-pot-hk-beef-curry-fb.jpg
title: Instant Pot HK Beef Curry
---

### Ingredients
* ▢ 2 pounds beef finger meat
* ▢ 1 large potato
* ▢ 2 tablespoons chu hou sauce
* ▢ 3 bay leaves
* ▢ 1 tablespoon fish sauce
* ▢ 3 tablespoons cold water

### Instructions
1. Brown beef in Instant Pot.
2. Saute aromatics and deglaze.
3. Pressure cook with potatoes.
4. Add coconut milk and thicken sauce.
5. Serve with rice.
Course: Dinner, Lunch, Main
Cuisine: Asian, Chinese, Hong Kong
Keyword: beef curry, instant pot curry

\`\`\`json
{
  "@context":"https://schema.org",
  "@type":"Recipe",
  "name":"Instant Pot HK Beef Curry",
  "recipeYield":["4","4 - 6"],
  "totalTime":"PT70M",
  "keywords":"beef curry, instant pot curry",
  "recipeIngredient":["2 pounds beef finger meat","1 large potato","2 tablespoons chu hou sauce","3 bay leaves","1 tablespoon fish sauce","3 tablespoons cold water"],
  "recipeInstructions":[
    {"@type":"HowToStep","text":"Brown beef in Instant Pot."},
    {"@type":"HowToStep","text":"Saute aromatics and deglaze."},
    {"@type":"HowToStep","text":"Pressure cook with potatoes."},
    {"@type":"HowToStep","text":"Add coconut milk and thicken sauce."},
    {"@type":"HowToStep","text":"Serve with rice."}
  ]
}
\`\`\`
`,
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://www.pressurecookrecipes.com/instant-pot-hk-beef-curry/"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    const instructions = createArg?.data.instructions as string[];
    expect(createArg?.data.title).toBe("Instant Pot HK Beef Curry");
    expect(createArg?.data.tags).toEqual(["beef curry", "instant pot curry"]);
    expect(createArg?.data.servings).toBe(4);
    expect(createArg?.data.cookTime).toBe(70);
    expect(instructions.some((line) => /^Course:/i.test(line))).toBe(false);
    expect(instructions.some((line) => /^Cuisine:/i.test(line))).toBe(false);
    expect(instructions.some((line) => /^Keyword:/i.test(line))).toBe(false);
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("normalizes imported note blobs and deduplicates html note echoes", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Butter Chicken",
          content: `# Butter Chicken

Ingredients
${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}

Instructions
${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}

Recipe Notes:
1\\. Garam Masala is easy to find. 2\\. Use pure chilli powder.`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <head>
              <meta property="og:image" content="https://cdn.example.com/butter.jpg" />
              <meta property="og:video" content="https://youtu.be/butter123456" />
            </head>
            <body>
              <h3>Recipe Notes:</h3>
              <p>1. Garam Masala is easy to find.</p>
            </body>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/butter"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(createArg?.data.notes).toEqual([
      "1. Garam Masala is easy to find.",
      "2. Use pure chilli powder.",
    ]);
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("filters bonappetit recirculation and serialized blobs from imported notes", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Slow-Roast Gochujang Chicken",
          content: `# Slow-Roast Gochujang Chicken

Ingredients
${Array.from({ length: 8 }, (_, i) => `- ${i + 1} cup stock`).join("\n")}

Instructions
${Array.from({ length: 5 }, (_, i) => `${i + 1}. Cook carefully.`).join("\n")}

## Recipe notes
Do Ahead: Chicken can be seasoned 12 hours ahead.
Back to topTriangle
CookingSalmon Tacos With Pineapple-Chile SalsaBy Christina Chaey
RecipesShockingly Easy No-Knead FocacciaBy Sarah Jampel
recipesSoy-Marinated EggsBy Sohui Kim
Cooking
window.__PRELOADED_STATE__ = {"componentConfig":{"OneNav":{"settings":{"id":"header_menu"}}}}
© 2026 Condé Nast. All rights reserved.
`,
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://www.bonappetit.com/recipe/slow-roast-gochujang-chicken"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(createArg?.data.notes).toEqual(["Do Ahead: Chicken can be seasoned 12 hours ahead."]);
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("backfills missing metadata on existing recipes without overwriting existing media", async () => {
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([
      { id: "recipe_existing", sourceUrl: "https://example.com/reimport" } as never,
    ]);
    vi.mocked(prisma.recipe.findFirst).mockResolvedValue({
      id: "recipe_existing",
      imageUrl: "https://cdn.example.com/existing.jpg",
      videoUrl: "https://youtu.be/existing12345",
      servings: null,
      prepTime: null,
      cookTime: null,
      tags: [],
    } as never);

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Reimport Pasta",
          content: `---
image: https://cdn.example.com/existing.jpg
---

# Reimport Pasta

Ingredients
${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}

Instructions
${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <script type="application/ld+json">
              {
                "@context":"https://schema.org",
                "@type":"Recipe",
                "name":"Reimport Pasta",
                "keywords":"quick, weeknight",
                "prepTime":"PT14M",
                "cookTime":"PT21M",
                "recipeYield":["4","4 - 5 people"],
                "recipeIngredient":["1 cup flour","1 tsp salt","1 tbsp oil","2 eggs"],
                "recipeInstructions":["Mix","Cook"]
              }
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/reimport"))
    );

    expect(prisma.recipe.create).not.toHaveBeenCalled();
    expect(prisma.recipe.update).toHaveBeenCalledTimes(1);
    const updateArg = vi.mocked(prisma.recipe.update).mock.calls[0]?.[0];
    expect(updateArg?.data.tags).toEqual(["quick", "weeknight"]);
    expect(updateArg?.data.prepTime).toBe(14);
    expect(updateArg?.data.cookTime).toBe(21);
    expect(updateArg?.data.servings).toBe(4);
    expect(updateArg?.data.imageUrl).toBeUndefined();
    expect(updateArg?.data.videoUrl).toBeUndefined();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_existing");
  });

  it("does not overwrite existing metadata on recipe re-import", async () => {
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([
      { id: "recipe_existing", sourceUrl: "https://example.com/reimport-keep" } as never,
    ]);
    vi.mocked(prisma.recipe.findFirst).mockResolvedValue({
      id: "recipe_existing",
      imageUrl: "https://cdn.example.com/existing.jpg",
      videoUrl: "https://youtu.be/existing12345",
      servings: 6,
      prepTime: 10,
      cookTime: 25,
      tags: ["family-favorite"],
    } as never);

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Reimport Keep",
          content: `---
image: https://cdn.example.com/existing.jpg
---

# Reimport Keep

Ingredients
${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}

Instructions
${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <script type="application/ld+json">
              {
                "@context":"https://schema.org",
                "@type":"Recipe",
                "name":"Reimport Keep",
                "keywords":"quick, weeknight",
                "prepTime":"PT14M",
                "cookTime":"PT21M",
                "recipeYield":["4","4 - 5 people"],
                "recipeIngredient":["1 cup flour","1 tsp salt","1 tbsp oil","2 eggs"],
                "recipeInstructions":["Mix","Cook"]
              }
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/reimport-keep"))
    );

    expect(prisma.recipe.create).not.toHaveBeenCalled();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_existing");
  });

  it("continues to HTML fallback when markdown lacks balanced ingredient/instruction coverage", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "No Ingredient Markdown",
          content: `# No Ingredient Markdown\n\nInstructions\n${Array.from({ length: 18 }, (_, i) => `${i + 1}. Long cooking step with enough detail to score highly in quality checks.`).join("\n")}`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"Recipe","name":"HTML Rescue","recipeIngredient":["1 cup broth","1 onion","2 cloves garlic","2 cups water","1 tsp salt","1 tbsp olive oil"],"recipeInstructions":["Boil broth","Add onion","Stir in garlic","Simmer 10 minutes","Season to taste","Serve hot"]}
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/html-rescue"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    const ingredientCount = Array.isArray(createArg?.data.ingredients)
      ? createArg.data.ingredients.length
      : 0;
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(ingredientCount).toBeGreaterThan(0);
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("falls back to direct HTML when markdown fails", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <script type="application/ld+json">
              {"@context":"https://schema.org","@type":"Recipe","name":"Soup","recipeIngredient":["1 cup broth","1 onion","2 cloves garlic","2 cups water","1 tsp salt","1 tbsp olive oil"],"recipeInstructions":["Boil broth","Add onion","Stir in garlic","Simmer 10 minutes","Season to taste","Serve hot"]}
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() => importRecipeFromUrl(buildFormData("https://example.com/soup")));

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("parses nested JSON-LD HowToSection instructions", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <script type="application/ld+json">
              {
                "@context":"https://schema.org",
                "@type":"Recipe",
                "name":"Layered Pie",
                "recipeIngredient":["2 cups flour","1 cup milk","1 tsp salt","2 eggs","1 tbsp butter","1 tbsp sugar"],
                "recipeInstructions":[
                  {
                    "@type":"HowToSection",
                    "name":"Dough",
                    "itemListElement":[
                      {"@type":"HowToStep","text":"Mix flour and butter"},
                      {"@type":"HowToStep","text":"Rest dough for 20 minutes"},
                      {"@type":"HowToStep","text":"Roll dough thin"}
                    ]
                  },
                  {
                    "@type":"HowToSection",
                    "name":"Bake",
                    "itemListElement":[
                      {"@type":"HowToStep","text":"Fill dough with custard"},
                      {"@type":"HowToStep","text":"Bake for 35 minutes"},
                      {"@type":"HowToStep","text":"Cool before slicing"}
                    ]
                  }
                ]
              }
            </script>
          </html>
        `,
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/pie"))
    );

    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("uses rendered worker fallback when direct HTML is blocked", async () => {
    vi.mocked(isRenderFallbackEnabled).mockReturnValue(true);
    vi.mocked(fetchRenderedRecipeCandidate).mockResolvedValue({
      finalUrl: "https://example.com/blocked-recipe",
      html: `
        <html>
          <script type="application/ld+json">
            {"@context":"https://schema.org","@type":"Recipe","name":"Rendered Curry","recipeIngredient":["1 cup coconut milk","2 tbsp curry paste","1 onion","2 garlic cloves","1 tbsp oil","1 cup stock"],"recipeInstructions":["Heat pan","Saute onion","Add garlic","Add curry paste","Pour stock and simmer","Serve warm"]}
          </script>
        </html>
      `,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: "Rendered Curry",
          recipeIngredient: [
            "1 cup coconut milk",
            "2 tbsp curry paste",
            "1 onion",
            "2 garlic cloves",
            "1 tbsp oil",
            "1 cup stock",
          ],
          recipeInstructions: [
            "Heat pan",
            "Saute onion",
            "Add garlic",
            "Add curry paste",
            "Pour stock and simmer",
            "Serve warm",
          ],
        },
      ],
    });

    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: false, status: 403 } as Response);

    const redirected = await withRedirect(() => importRecipeFromUrl(buildFormData("https://example.com/blocked")));

    expect(fetchRenderedRecipeCandidate).toHaveBeenCalled();
    expect(prisma.recipe.create).toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });

  it("returns no_recipe_data when all stages fail to parse useful content", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<html><body><h1>Welcome</h1><p>Nothing structured here.</p></body></html>",
      } as Response);

    const redirected = await withRedirect(() => importRecipeFromUrl(buildFormData("https://example.com/unknown")));

    expect(prisma.recipe.create).not.toHaveBeenCalled();
    expect(redirected).toBe("REDIRECT:/recipes?importError=no_recipe_data");
  });
});
