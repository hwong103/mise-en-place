import type {
  IngestionErrorCode,
  IngestionStage,
  RecipeIngestionCandidate,
} from "@/lib/recipe-ingestion-types";

type RecipeIngestionDiagnostics = {
  sourceUrl: string;
  sourceHost: string;
  sourcePlatform?: "instagram" | "web";
  stageUsed?: IngestionStage;
  resultQualityScore: number;
  failureReason?: IngestionErrorCode;
  webMcpTrackingEnabled?: boolean;
  draftCreated?: boolean;
  assistedOcrUsed?: boolean;
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
