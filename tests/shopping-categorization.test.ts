import fixtures from "./fixtures/ingredient-categories.json";
import { classifyIngredient, type IngredientCategory } from "@/lib/ingredient-classifier";
import { buildShoppingList } from "@/lib/shopping";

type FixtureCase = {
  line: string;
  category: IngredientCategory;
};

const CASES = fixtures as FixtureCase[];

describe("shopping ingredient categorization", () => {
  it("classifies mushroom and eshallot variants as produce", () => {
    const lines = ["mushroom", "mushrooms", "eshallot", "eshallots", "eschallot", "shallots"];
    for (const line of lines) {
      expect(classifyIngredient(line).category).toBe("Produce");
    }
  });

  it("applies storage-first overrides for packaged produce", () => {
    const lines = ["canned tomatoes", "dried mushrooms", "frozen peas", "jarred peppers"];
    for (const line of lines) {
      expect(classifyIngredient(line).category).toBe("Canned & Jarred");
    }
  });

  it("handles disambiguation between dry goods and canned or jarred staples", () => {
    const dryGoodsLines = ["red wine vinegar", "dijon mustard", "soy sauce", "fish sauce", "almond milk"];
    for (const line of dryGoodsLines) {
      expect(classifyIngredient(line).category).toBe("Dry Goods");
    }

    const cannedJarredLines = ["beef stock", "canned tomatoes", "coconut milk"];
    for (const line of cannedJarredLines) {
      expect(classifyIngredient(line).category).toBe("Canned & Jarred");
    }

    const meatLines = ["chicken breast", "ground beef", "salmon fillet"];
    for (const line of meatLines) {
      expect(classifyIngredient(line).category).toBe("Meat");
    }
  });

  it("dedupes canonical ingredients while preserving category", () => {
    const categories = buildShoppingList([
      { line: "200g mushrooms", recipeTitle: "Risotto" },
      { line: "1 cup mushroom", recipeTitle: "Pasta" },
      { line: "2 eshallots", recipeTitle: "Risotto" },
      { line: "1 shallot", recipeTitle: "Stew" },
    ]);

    const produce = categories.find((category) => category.name === "Produce");
    expect(produce).toBeTruthy();
    expect(produce?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: "Mushroom", count: 2 }),
        expect.objectContaining({ line: "Shallot", count: 2 }),
      ])
    );
  });

  it("sums compact amount tokens for same canonical ingredient", () => {
    const categories = buildShoppingList([
      { line: "200g mushrooms", recipeTitle: "Recipe A" },
      { line: "400g mushroom", recipeTitle: "Recipe B" },
    ]);

    const produce = categories.find((category) => category.name === "Produce");
    const mushroom = produce?.items.find((item) => item.line === "Mushroom");
    expect(mushroom?.amountSummary).toBe("600 g");
  });

  it("meets 99% accuracy on the labeled ingredient fixture", () => {
    const failures: Array<{ line: string; expected: IngredientCategory; actual: IngredientCategory }> = [];

    for (const testCase of CASES) {
      const result = classifyIngredient(testCase.line);
      if (result.category !== testCase.category) {
        failures.push({
          line: testCase.line,
          expected: testCase.category,
          actual: result.category,
        });
      }
    }

    const accuracy = (CASES.length - failures.length) / CASES.length;
    if (accuracy < 0.99) {
      const details = failures
        .slice(0, 20)
        .map((failure) => `"${failure.line}": expected ${failure.expected}, got ${failure.actual}`)
        .join("\n");
      throw new Error(`Categorization accuracy ${(accuracy * 100).toFixed(2)}% is below 99%.\n${details}`);
    }

    expect(accuracy).toBeGreaterThanOrEqual(0.99);
  });
});
