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

  it("leaves non-leading or unsupported measurements unchanged", () => {
    expect(convertIngredientMeasurementToMetric("salt, to taste")).toBe("salt, to taste");
    expect(convertIngredientMeasurementToMetric("1 can (14-oz) tomatoes")).toBe("1 can (14-oz) tomatoes");
  });
});
