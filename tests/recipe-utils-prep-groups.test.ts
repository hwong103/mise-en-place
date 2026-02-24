import { buildPrepGroupsFromInstructions } from "@/lib/recipe-utils";

describe("buildPrepGroupsFromInstructions", () => {
  it("prioritizes explicit prep hints in ingredient lines over cooking verbs", () => {
    const ingredients = [
      "2 tbsp vegetable oil, divided",
      "1 large onion, sliced",
      "300 g mushrooms, sliced (not too thin)",
    ];
    const instructions = [
      "Heat 1 tbsp oil in a large skillet over high heat.",
      "Add onions and mushrooms. Cook until softened.",
    ];

    const groups = buildPrepGroupsFromInstructions(ingredients, instructions);
    const sliceGroup = groups.find((group) => group.title.toLowerCase() === "slice");
    const hasHeatGroup = groups.some((group) => group.title.toLowerCase() === "heat");

    expect(sliceGroup).toBeDefined();
    expect(sliceGroup?.items).toContain("1 large onion, sliced");
    expect(sliceGroup?.items).toContain("300 g mushrooms, sliced (not too thin)");
    expect(hasHeatGroup).toBe(false);
  });

  it("merges repeated instruction-derived prep titles into one group", () => {
    const ingredients = ["600 g beef strips", "1 red capsicum", "1 onion"];
    const instructions = [
      "Slice beef strips into thin pieces.",
      "Slice capsicum and onion.",
    ];

    const groups = buildPrepGroupsFromInstructions(ingredients, instructions);
    const sliceGroups = groups.filter((group) => group.title.toLowerCase() === "slice");

    expect(sliceGroups).toHaveLength(1);
    expect(sliceGroups[0].items).toEqual(
      expect.arrayContaining(["600 g beef strips", "1 red capsicum", "1 onion"])
    );
  });
});
