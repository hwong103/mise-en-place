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

  it("keeps markdown as selected content while still fetching HTML metadata", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Fast Pasta",
          content: `# Fast Pasta\n\nIngredients\n${Array.from({ length: 12 }, (_, i) => `- ${i + 1} cup flour`).join("\n")}\n\nInstructions\n${Array.from({ length: 10 }, (_, i) => `${i + 1}. Mix and cook`).join("\n")}`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          `<html><head><meta property="og:image" content="https://example.com/fast-pasta.jpg" /></head></html>`,
      } as Response);

    const redirected = await withRedirect(() => importRecipeFromUrl(buildFormData("https://example.com/r")));

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(prisma.recipe.create).toHaveBeenCalled();
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

  it("keeps serving ingredients and drops long prose from markdown imports", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          title: "Beef Stroganoff",
          content: `# Beef Stroganoff

Ingredients
### Beef
- 500 g beef strips
- 1 onion
### Sauce
- 1 cup sour cream
- 1 tbsp mustard
### RECIPE VIDEO ABOVE
This is a long editorial paragraph about the history of this dish and why the sauce is nostalgic for many families.
### Serving
- 250g pasta
- Chopped chives

Instructions
1. Sear beef.
2. Cook onions.
3. Stir in sauce.
4. Simmer gently.
5. Boil pasta.
6. Serve with chives.`,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<html></html>",
      } as Response);

    const redirected = await withRedirect(() =>
      importRecipeFromUrl(buildFormData("https://example.com/stroganoff"))
    );

    const createArg = vi.mocked(prisma.recipe.create).mock.calls[0]?.[0];
    expect(createArg).toBeDefined();
    expect(createArg?.data.ingredients).toContain("250g pasta");
    expect(createArg?.data.ingredients).toContain("Chopped chives");
    expect(createArg?.data.ingredients).not.toContain(
      "This is a long editorial paragraph about the history of this dish and why the sauce is nostalgic for many families."
    );
    expect(redirected).toBe("REDIRECT:/recipes/recipe_1");
  });
});
