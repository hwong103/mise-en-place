import {
  buildInstagramCandidate,
  extractInstagramCaptionCandidate,
  mergeInstagramAssistedOcr,
  parseInstagramCaptionToLines,
} from "@/lib/instagram-recipe-import";

describe("instagram recipe import helpers", () => {
  it("prefers assisted caption over markdown body", () => {
    const caption = extractInstagramCaptionCandidate("# ignore this", "Ingredients\n- 1 cup milk");
    expect(caption).toBe("Ingredients\n- 1 cup milk");
  });

  it("parses mixed caption text into ingredient and instruction lines", () => {
    const parsed = parseInstagramCaptionToLines(`Ingredients\n- 2 eggs\n- 1 cup flour\nInstructions\n1. Mix ingredients\n2. Bake for 20 minutes`);

    expect(parsed.ingredients).toEqual(["2 eggs", "1 cup flour"]);
    expect(parsed.instructions).toEqual(["Mix ingredients", "Bake for 20 minutes"]);
  });

  it("merges assisted OCR lines and deduplicates overlap", () => {
    const merged = mergeInstagramAssistedOcr(
      {
        ingredients: ["1 cup flour", "2 eggs"],
        instructions: ["Mix ingredients"],
        notes: ["Use room temp eggs"],
      },
      [
        {
          title: "Instagram Cake",
          ingredients: ["2 eggs", "1 tsp vanilla"],
          instructions: ["Mix ingredients", "Bake for 20 minutes"],
          notes: ["Use room temp eggs", "Cool before slicing"],
          servings: 4,
          prepTime: 10,
          cookTime: 20,
        },
      ]
    );

    expect(merged.title).toBe("Instagram Cake");
    expect(merged.ingredients).toEqual(["1 cup flour", "2 eggs", "1 tsp vanilla"]);
    expect(merged.instructions).toEqual(["Mix ingredients", "Bake for 20 minutes"]);
    expect(merged.notes).toEqual(["Use room temp eggs", "Cool before slicing"]);
    expect(merged.servings).toBe(4);
  });

  it("builds assisted OCR stage candidate for instagram", () => {
    const candidate = buildInstagramCandidate({
      sourceUrl: "https://www.instagram.com/reel/abc123",
      title: "Caption Cake",
      markdown: "Ingredients\n- 1 cup flour\nInstructions\n1. Stir",
      assistedRecipes: [
        {
          title: "OCR Cake",
          ingredients: ["1 cup flour", "2 eggs"],
          instructions: ["Stir", "Bake"],
          notes: [],
        },
      ],
      latencyMs: 40,
    });

    expect(candidate.stage).toBe("instagram_assisted_ocr");
    expect(candidate.sourcePlatform).toBe("instagram");
    expect(candidate.ingredients).toContain("2 eggs");
    expect(candidate.instructions).toContain("Bake");
    expect(candidate.success).toBe(true);
  });
});
