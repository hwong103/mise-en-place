import { getRecipeIngredientLines } from "@/lib/recipe-utils";

describe("getRecipeIngredientLines", () => {
  it("returns cleaned direct ingredients when no source groups exist", () => {
    expect(
      getRecipeIngredientLines([" 1 onion ", "- 2 carrots"], [])
    ).toEqual(["1 onion", "2 carrots"]);
  });

  it("prefers source-group ingredients when present", () => {
    expect(
      getRecipeIngredientLines(
        [],
        [
          { title: "Ingredients", items: ["1 onion", "2 carrots"], sourceGroup: true },
          { title: "Prep", items: ["dice onion"], sourceGroup: false },
        ]
      )
    ).toEqual(["1 onion", "2 carrots"]);
  });
});
