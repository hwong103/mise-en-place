import type {
  IngestionErrorCode,
  IngestionStage,
  RecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-types";

type RecipeIngestionDiagnostics = {
  sourceUrl: string;
  sourceHost: string;
  stageUsed?: IngestionStage;
  resultQualityScore: number;
  failureReason?: IngestionErrorCode;
  webMcpTrackingEnabled?: boolean;
  attempts: Array<{
    stage: IngestionStage;
    success: boolean;
    latencyMs: number;
    errorCode?: IngestionErrorCode;
    ingredients: number;
    instructions: number;
  }>;
  selected?: Pick<RecipeIngestionCandidate, "stage" | "title" | "ingredients" | "instructions">;
};

export const logRecipeIngestionDiagnostics = (payload: RecipeIngestionDiagnostics) => {
  console.info("[recipe-ingestion]", JSON.stringify(payload));
};
