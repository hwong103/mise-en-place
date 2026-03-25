import { describe, expect, it } from "vitest";

import { getVisibleRightTab } from "@/components/recipes/RecipeDetailTabs";

describe("getVisibleRightTab", () => {
  it("keeps notes visible when the recipe has no video", () => {
    expect(getVisibleRightTab("notes", null)).toBe("notes");
  });

  it("falls back to instructions when watch is selected without a video", () => {
    expect(getVisibleRightTab("watch", null)).toBe("instructions");
  });

  it("keeps watch visible when a video exists", () => {
    expect(getVisibleRightTab("watch", "https://youtu.be/example")).toBe("watch");
  });
});
