"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { getCurrentHouseholdId } from "@/lib/household";
import { logServerPerf } from "@/lib/server-perf";
import {
  buildPrepGroupsFromInstructions,
  cleanIngredientLines,
  cleanInstructionLines,
  cleanTextLines,
  coerceStringArray,
  parseLines,
  parsePrepGroupsFromText,
  parseTags,
  type PrepGroup,
} from "@/lib/recipe-utils";

const toOptionalInt = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.trunc(parsed);
};

const toOptionalString = (value: FormDataEntryValue | null) => {
  if (value === null) {
    return undefined;
  }

  const trimmed = value.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalUrl = (value: FormDataEntryValue | null) => {
  const raw = toOptionalString(value);
  if (!raw) {
    return undefined;
  }

  try {
    new URL(raw);
    return raw;
  } catch {
    return undefined;
  }
};

const normalizeSourceUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (url.protocol === "http:") {
      url.protocol = "https:";
    }
    if (url.pathname !== "/") {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return undefined;
  }
};

const normalizeVideoUrl = (value: string | undefined) => {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://youtu.be/${id}` : value;
    }

    if (hostname.endsWith("youtube.com") || hostname.endsWith("youtube-nocookie.com")) {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        return id ? `https://youtu.be/${id}` : value;
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id ? `https://youtu.be/${id}` : value;
      }
    }

    if (
      hostname === "vimeo.com" ||
      hostname === "player.vimeo.com" ||
      hostname.endsWith(".vimeo.com")
    ) {
      const idMatch = url.pathname.match(/(\d+)/);
      const id = idMatch ? idMatch[1] : null;
      return id ? `https://vimeo.com/${id}` : value;
    }
  } catch {
    return undefined;
  }

  return value;
};

export async function updateRecipeSection(formData: FormData) {
  const startedAt = Date.now();
  const recipeId = toOptionalString(formData.get("recipeId"));
  const section = toOptionalString(formData.get("section"));
  if (!recipeId || !section) {
    logServerPerf({
      phase: "recipes.update_section_write",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      meta: {
        recipe_id: recipeId ?? null,
        section: section ?? null,
        reason: "missing_input",
      },
    });
    return;
  }

  let householdId: string | undefined;
  try {
    householdId = await getCurrentHouseholdId();
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, householdId },
    });

    if (!recipe) {
      logServerPerf({
        phase: "recipes.update_section_write",
        route: "/recipes/[id]",
        startedAt,
        success: false,
        householdId,
        meta: { recipe_id: recipeId, section, reason: "missing_recipe" },
      });
      return;
    }

    const existingNotes = coerceStringArray(recipe.notes);
    const existingIngredients = coerceStringArray(recipe.ingredients);
    const existingInstructions = coerceStringArray(recipe.instructions);

    if (section === "ingredients") {
      const raw = parseLines(formData.get("ingredients")?.toString() ?? "");
      const cleanedIngredients = cleanIngredientLines(raw);
      const cleanedInstructions = cleanInstructionLines(existingInstructions);
      const instructionPrepGroups = buildPrepGroupsFromInstructions(
        cleanedIngredients.lines,
        cleanedInstructions.lines
      );

      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          ingredientCount: cleanedIngredients.lines.length,
          ingredients: cleanedIngredients.lines,
          notes: existingNotes.length > 0 ? existingNotes : cleanedIngredients.notes,
          prepGroups: instructionPrepGroups,
        },
      });
    }

    if (section === "instructions") {
      const raw = parseLines(formData.get("instructions")?.toString() ?? "");
      const cleanedInstructions = cleanInstructionLines(raw);
      const cleanedIngredients = cleanIngredientLines(existingIngredients);
      const instructionPrepGroups = buildPrepGroupsFromInstructions(
        cleanedIngredients.lines,
        cleanedInstructions.lines
      );

      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          instructions: cleanedInstructions.lines,
          notes: existingNotes.length > 0 ? existingNotes : cleanedInstructions.notes,
          prepGroups: instructionPrepGroups,
        },
      });
    }

    if (section === "notes") {
      const raw = parseLines(formData.get("notes")?.toString() ?? "");
      const cleanedNotes = cleanTextLines(raw);
      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          notes: cleanedNotes,
        },
      });
    }

    if (section === "prepGroups") {
      const raw = formData.get("prepGroups")?.toString() ?? "";
      const prepGroups = parsePrepGroupsFromText(raw);
      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          prepGroups,
        },
      });
    }

    if (section === "overview") {
      const title = toOptionalString(formData.get("title")) ?? recipe.title;
      const description = toOptionalString(formData.get("description"));
      const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
      const imageUrl = toOptionalUrl(formData.get("imageUrl"));
      const videoUrl = toOptionalUrl(formData.get("videoUrl"));
      const servings = toOptionalInt(formData.get("servings"));
      const prepTime = toOptionalInt(formData.get("prepTime"));
      const cookTime = toOptionalInt(formData.get("cookTime"));
      const tags = parseTags(formData.get("tags")?.toString() ?? "");

      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          title,
          description: description ?? recipe.description,
          sourceUrl: normalizeSourceUrl(sourceUrl) ?? sourceUrl ?? recipe.sourceUrl,
          imageUrl: imageUrl ?? recipe.imageUrl,
          videoUrl: normalizeVideoUrl(videoUrl) ?? videoUrl ?? recipe.videoUrl,
          servings: servings ?? recipe.servings,
          prepTime: prepTime ?? recipe.prepTime,
          cookTime: cookTime ?? recipe.cookTime,
          tags: tags.length > 0 ? tags : recipe.tags,
        },
      });
    }

    if (section === "all") {
      const title = toOptionalString(formData.get("title")) ?? recipe.title;
      const description = toOptionalString(formData.get("description"));
      const sourceUrl = toOptionalUrl(formData.get("sourceUrl"));
      const imageUrl = toOptionalUrl(formData.get("imageUrl"));
      const videoUrl = toOptionalUrl(formData.get("videoUrl"));
      const servings = toOptionalInt(formData.get("servings"));
      const prepTime = toOptionalInt(formData.get("prepTime"));
      const cookTime = toOptionalInt(formData.get("cookTime"));
      const tags = parseTags(formData.get("tags")?.toString() ?? "");

      const rawIngredients = parseLines(formData.get("ingredients")?.toString() ?? "");
      const cleanedIngredients = cleanIngredientLines(rawIngredients);
      const rawInstructions = parseLines(formData.get("instructions")?.toString() ?? "");
      const cleanedInstructions = cleanInstructionLines(rawInstructions);
      const rawNotes = parseLines(formData.get("notes")?.toString() ?? "");
      const cleanedNotes = cleanTextLines(rawNotes);

      // Collect ingredient groups (sourceGroup=true) from the Ingredients card
      const ingredientGroups: PrepGroup[] = [];
      let gIdx = 0;
      while (formData.get(`ingredientGroupExists_${gIdx}`)) {
        const title = formData.get(`ingredientGroupTitle_${gIdx}`) as string || "";
        const itemsRaw = formData.get(`ingredientGroupItems_${gIdx}`) as string || "";
        const items = itemsRaw.split("\n").filter(Boolean);
        if (items.length > 0) {
          ingredientGroups.push({ title, items, sourceGroup: true });
        }
        gIdx++;
      }

      // Collect mise/prep groups (sourceGroup=false) from the Prep Groups card
      const miseGroups: PrepGroup[] = [];
      let mIdx = 0;
      while (formData.get(`miseGroupExists_${mIdx}`)) {
        const title = formData.get(`miseGroupTitle_${mIdx}`) as string || "";
        const itemsRaw = formData.get(`miseGroupItems_${mIdx}`) as string || "";
        const items = itemsRaw.split("\n").filter(Boolean);
        if (items.length > 0) {
          miseGroups.push({ title, items, sourceGroup: false });
        }
        mIdx++;
      }

      const allPrepGroups = [...ingredientGroups, ...miseGroups];

      await prisma.recipe.updateMany({
        where: { id: recipeId, householdId },
        data: {
          title,
          description: description ?? recipe.description,
          sourceUrl: normalizeSourceUrl(sourceUrl) ?? sourceUrl ?? recipe.sourceUrl,
          imageUrl: imageUrl ?? recipe.imageUrl,
          videoUrl: normalizeVideoUrl(videoUrl) ?? videoUrl ?? recipe.videoUrl,
          servings: servings ?? recipe.servings,
          prepTime: prepTime ?? recipe.prepTime,
          cookTime: cookTime ?? recipe.cookTime,
          tags: tags.length > 0 ? tags : recipe.tags,
          ingredientCount: cleanedIngredients.lines.length,
          ingredients: cleanedIngredients.lines,
          instructions: cleanedInstructions.lines,
          notes:
            cleanedNotes.length > 0
              ? cleanedNotes
              : existingNotes.length > 0
                ? existingNotes
                : cleanedIngredients.notes,
          prepGroups: allPrepGroups,
        },
      });
    }
  } catch (error) {
    logServerPerf({
      phase: "recipes.update_section_write",
      route: "/recipes/[id]",
      startedAt,
      success: false,
      householdId,
      meta: {
        recipe_id: recipeId,
        section,
        error: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }

  logServerPerf({
    phase: "recipes.update_section_write",
    route: "/recipes/[id]",
    startedAt,
    success: true,
    householdId,
    meta: { recipe_id: recipeId, section },
  });

  revalidatePath(`/recipes/${recipeId}`);
  redirect(`/recipes/${recipeId}`);
}

export async function deleteRecipe(formData: FormData) {
  const recipeId = toOptionalString(formData.get("recipeId"));
  if (!recipeId) {
    return;
  }

  const householdId = await getCurrentHouseholdId();

  await prisma.mealPlan.deleteMany({
    where: { recipeId, householdId },
  });

  await prisma.recipe.deleteMany({
    where: { id: recipeId, householdId },
  });

  revalidatePath("/recipes");
  revalidatePath("/planner");
  revalidatePath("/shopping");
  redirect("/recipes");
}

export async function updatePrepGroupsOrder(formData: FormData) {
  const recipeId = formData.get("recipeId")?.toString();
  const prepGroupsRaw = formData.get("prepGroups")?.toString();

  if (!recipeId || !prepGroupsRaw) {
    return;
  }

  const householdId = await getCurrentHouseholdId();
  try {
    const prepGroups = JSON.parse(prepGroupsRaw);
    await prisma.recipe.updateMany({
      where: { id: recipeId, householdId },
      data: { prepGroups },
    });
    revalidatePath(`/recipes/${recipeId}`);
  } catch (error) {
    console.error("Failed to update prep groups order:", error);
  }
}
