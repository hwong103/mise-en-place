export const DEFAULT_SHOPPING_LOCATION = "Woolies";
export const DEFAULT_SHOPPING_LOCATIONS = [
  "Woolies",
  "Tong Li",
  "Dan Murphys",
  "Butcher",
] as const;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeShoppingLine = normalize;
export const normalizeShoppingCategory = normalize;

export const normalizeShoppingLocation = (
  value: string | null | undefined
) => {
  const trimmed = value?.toString().trim();
  return trimmed && trimmed.length > 0
    ? trimmed.replace(/\s+/g, " ")
    : DEFAULT_SHOPPING_LOCATION;
};

export const buildShoppingItemKey = (
  category: string,
  line: string,
  manual: boolean
) =>
  `${manual ? "manual" : "auto"}-${normalizeShoppingCategory(category)}-${normalizeShoppingLine(line)}`;

export const buildShoppingLocationPreferenceKey = (
  category: string,
  line: string
) => `${normalizeShoppingCategory(category)}-${normalizeShoppingLine(line)}`;
