import { Prisma } from "@prisma/client";

export const readStringArray = (value: Prisma.JsonValue | null | undefined): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
};

export const writeStringArray = (value: string[] | null | undefined): Prisma.InputJsonValue => {
  if (!value || value.length === 0) {
    return [];
  }

  return value;
};
