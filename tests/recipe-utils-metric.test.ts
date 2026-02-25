import { convertIngredientMeasurementToMetric } from "@/lib/recipe-utils";

describe("convertIngredientMeasurementToMetric", () => {
  it("converts pound ranges with mixed fractions to metric", () => {
    expect(convertIngredientMeasurementToMetric("3½–4-lb. chicken")).toBe("1.6-1.8 kg chicken");
    expect(convertIngredientMeasurementToMetric("31/2-4 lb chicken")).toBe("1.6-1.8 kg chicken");
  });

  it("converts pounds under one kilogram to grams", () => {
    expect(convertIngredientMeasurementToMetric("1 lb ground beef")).toBe("454 g ground beef");
  });

  it("converts cups and spoons to milliliters", () => {
    expect(convertIngredientMeasurementToMetric("2 cups stock")).toBe("480 ml stock");
    expect(convertIngredientMeasurementToMetric("1 tbsp olive oil")).toBe("15 ml olive oil");
    expect(convertIngredientMeasurementToMetric("1 tsp salt")).toBe("5 ml salt");
  });

  it("converts measurements when they appear mid-sentence", () => {
    expect(
      convertIngredientMeasurementToMetric("Roast a 3½–4-lb. whole chicken until cooked through.")
    ).toBe("Roast a 1.6-1.8 kg whole chicken until cooked through.");
  });

  it("avoids inverted metric ranges from merged mixed fractions", () => {
    expect(convertIngredientMeasurementToMetric("31/2-4-lb. whole chicken")).toBe(
      "1.6-1.8 kg whole chicken"
    );
  });

  it("leaves unsupported lines unchanged and still converts parenthetical units", () => {
    expect(convertIngredientMeasurementToMetric("salt, to taste")).toBe("salt, to taste");
    expect(convertIngredientMeasurementToMetric("1 can (14-oz) tomatoes")).toBe("1 can (397 g) tomatoes");
  });
});
