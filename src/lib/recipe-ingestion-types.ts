import type { PrepGroup } from "@/lib/recipe-utils";

export type IngestionStage = "markdown" | "http_html" | "rendered_html" | "readability";

export type IngestionErrorCode =
  | "fetch_failed"
  | "blocked"
  | "timeout"
  | "no_recipe_data"
  | "insufficient_steps"
  | "parse_failed"
  | "disabled";

export type IngestionAttemptResult = {
  stage: IngestionStage;
  success: boolean;
  title?: string;
  ingredients: string[];
  instructions: string[];
  notes: string[];
  errorCode?: IngestionErrorCode;
  latencyMs: number;
};

export type RecipeIngestionCandidate = IngestionAttemptResult & {
  description?: string;
  imageUrl?: string;
  videoUrl?: string;
  tags?: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredientGroups?: PrepGroup[];
  html?: string;
};
