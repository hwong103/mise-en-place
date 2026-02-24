import { parseMarkdownRecipe } from "@/lib/recipe-import";

describe("parseMarkdownRecipe", () => {
  it("extracts title, ingredients, instructions and tags", () => {
    const markdown = `# Crispy Tofu Bowl\n\nQuick dinner bowl.\n\nIngredients\n- 1 block tofu\n- 2 tbsp soy sauce\n\nInstructions\n1. Press tofu.\n2. Pan-fry until crisp.\n\nTags: weeknight, vegetarian\n`;

    const parsed = parseMarkdownRecipe(markdown);

    expect(parsed.title).toBe("Crispy Tofu Bowl");
    expect(parsed.description).toContain("Quick dinner bowl");
    expect(parsed.ingredients).toEqual(["1 block tofu", "2 tbsp soy sauce"]);
    expect(parsed.instructions).toEqual(["Press tofu.", "Pan-fry until crisp."]);
    expect(parsed.tags).toEqual(["weeknight", "vegetarian"]);
  });

  it("falls back when no explicit headings exist", () => {
    const markdown = "Simple Lentil Soup\nA cozy soup for cold nights.";
    const parsed = parseMarkdownRecipe(markdown, "Fallback Title");

    expect(parsed.title).toBe("Fallback Title");
    expect(parsed.description).toContain("A cozy soup for cold nights.");
    expect(parsed.ingredients).toEqual([]);
    expect(parsed.instructions).toEqual([]);
  });

  it("keeps collecting ingredients across subsection headings", () => {
    const markdown = `# Beef Stroganoff\n\nIngredients\n### Beef\n- 500g beef strips\n- 1 onion\n### Sauce\n- 1 cup sour cream\n- 1 tbsp mustard\n### Serving\n- Pasta\n- Chives\n\nInstructions\n1. Sear beef.\n2. Make sauce.`;

    const parsed = parseMarkdownRecipe(markdown);

    expect(parsed.ingredients).toEqual([
      "500g beef strips",
      "1 onion",
      "1 cup sour cream",
      "1 tbsp mustard",
      "Pasta",
      "Chives",
    ]);
    expect(parsed.instructions).toEqual(["Sear beef.", "Make sauce."]);
  });
});
