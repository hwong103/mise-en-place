import {
  classifyIngestionFailure,
  scoreRecipeIngestionCandidate,
  selectBestRecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-quality";
import type { RecipeIngestionCandidate } from "@/lib/recipe-ingestion-types";

const candidate = (overrides: Partial<RecipeIngestionCandidate>): RecipeIngestionCandidate => ({
  stage: "markdown",
  success: true,
  title: "Recipe",
  ingredients: ["1 cup flour", "1 tsp salt"],
  instructions: ["Mix ingredients", "Bake for 20 minutes"],
  notes: [],
  latencyMs: 10,
  ...overrides,
});

describe("recipe ingestion quality scoring", () => {
  it("scores richer candidates higher", () => {
    const high = candidate({
      ingredients: Array.from({ length: 10 }, (_, idx) => `${idx + 1} tbsp ingredient`),
      instructions: Array.from({ length: 8 }, (_, idx) => `${idx + 1}. Cook step`),
    });

    const low = candidate({
      ingredients: ["salt"],
      instructions: [],
      description: undefined,
      title: undefined,
    });

    expect(scoreRecipeIngestionCandidate(high)).toBeGreaterThan(scoreRecipeIngestionCandidate(low));
  });

  it("selects highest score and applies stage tie-breaker", () => {
    const markdown = candidate({ stage: "markdown", ingredients: ["1 cup flour"], instructions: ["Mix"] });
    const html = candidate({ stage: "http_html", ingredients: ["1 cup flour"], instructions: ["Mix"] });

    const selected = selectBestRecipeIngestionCandidate([html, markdown]);

    expect(selected.candidate?.stage).toBe("markdown");
  });

  it("classifies blocked and insufficient steps failure reasons", () => {
    const blocked = classifyIngestionFailure(
      [{ errorCode: "blocked" }],
      null
    );
    expect(blocked).toBe("blocked");

    const insufficient = classifyIngestionFailure(
      [],
      candidate({ ingredients: ["1 cup rice"], instructions: [] })
    );
    expect(insufficient).toBe("insufficient_steps");
  });
});
