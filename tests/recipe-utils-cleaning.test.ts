import { describe, expect, it } from "vitest";
import { cleanInstructionLines } from "@/lib/recipe-utils";

describe("cleanInstructionLines", () => {
  it("keeps instruction steps that start with prep/cook words", () => {
    const result = cleanInstructionLines([
      "Prep onions and garlic until fragrant.",
      "Cook noodles in salted water.",
    ]);

    expect(result.lines).toEqual([
      "Prep onions and garlic until fragrant.",
      "Cook noodles in salted water.",
    ]);
  });

  it("drops metadata lines with explicit labels", () => {
    const result = cleanInstructionLines([
      "Prep Time: 15 minutes",
      "Cook Time: 25 minutes",
      "Equipment: Dutch oven",
      "Simmer sauce for 10 minutes.",
    ]);

    expect(result.lines).toEqual(["Simmer sauce for 10 minutes."]);
  });
});
