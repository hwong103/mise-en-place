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
  const serialized = JSON.stringify(payload);

  if (payload.failureReason) {
    console.warn("[recipe-ingestion:failure]", serialized);
    return;
  }

  console.info("[recipe-ingestion]", serialized);
};
