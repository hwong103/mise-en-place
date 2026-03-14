import type { JsonValue } from "@/lib/db-types";

export const readStringArray = (value: JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

export const writeStringArray = (value: string[] | null | undefined): JsonValue => {
  if (!value || value.length === 0) {
    return [];
  }

  return value;
};
