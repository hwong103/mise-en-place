import type {
  IngestionErrorCode,
  IngestionStage,
  RecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-types";

const STAGE_PRIORITY: Record<IngestionStage, number> = {
  markdown: 4,
  http_html: 3,
  rendered_html: 2,
  readability: 1,
};

export const MIN_INGESTION_SCORE = 35;
export const HIGH_CONFIDENCE_INGESTION_SCORE = 55;

const normalizeLine = (value: string) => value.trim().replace(/\s+/g, " ");

const averageLength = (lines: string[]) => {
  if (lines.length === 0) {
    return 0;
  }
  return lines.reduce((sum, line) => sum + normalizeLine(line).length, 0) / lines.length;
};

export const scoreRecipeIngestionCandidate = (candidate: RecipeIngestionCandidate) => {
  const ingredientCount = candidate.ingredients.length;
  const instructionCount = candidate.instructions.length;

  let score = 0;

  score += Math.min(ingredientCount, 20) * 2.2;
  score += Math.min(instructionCount, 20) * 2.8;

  if (candidate.title) {
    score += 10;
  }

  if (candidate.description) {
    score += 4;
  }

  const ingredientLength = averageLength(candidate.ingredients);
  const instructionLength = averageLength(candidate.instructions);

  if (ingredientLength >= 8) {
    score += 4;
  }

  if (instructionLength >= 18) {
    score += 6;
  }

  if (ingredientCount > 0 && instructionCount === 0) {
    score -= 14;
  }

  if (instructionCount > 0 && ingredientCount === 0) {
    score -= 10;
  }

  if (candidate.errorCode) {
    score -= 12;
  }

  return Math.max(0, Math.round(score));
};

export const selectBestRecipeIngestionCandidate = (
  candidates: RecipeIngestionCandidate[]
): { candidate: RecipeIngestionCandidate | null; score: number } => {
  if (candidates.length === 0) {
    return { candidate: null, score: 0 };
  }

  const ranked = [...candidates].sort((a, b) => {
    const scoreDiff = scoreRecipeIngestionCandidate(b) - scoreRecipeIngestionCandidate(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return STAGE_PRIORITY[b.stage] - STAGE_PRIORITY[a.stage];
  });

  const winner = ranked[0];
  return {
    candidate: winner,
    score: scoreRecipeIngestionCandidate(winner),
  };
};

export const classifyIngestionFailure = (
  attempts: Array<{ errorCode?: IngestionErrorCode }>,
  bestCandidate: RecipeIngestionCandidate | null
): IngestionErrorCode => {
  if (bestCandidate && bestCandidate.ingredients.length > 0 && bestCandidate.instructions.length === 0) {
    return "insufficient_steps";
  }

  if (attempts.some((attempt) => attempt.errorCode === "blocked")) {
    return "blocked";
  }

  if (attempts.some((attempt) => attempt.errorCode === "timeout")) {
    return "fetch_failed";
  }

  return "no_recipe_data";
};
