ALTER TABLE "Recipe"
ADD COLUMN "ingredientCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Recipe"
SET "ingredientCount" = CASE
  WHEN jsonb_typeof("ingredients"::jsonb) = 'array'
    THEN jsonb_array_length("ingredients"::jsonb)
  ELSE 0
END;

CREATE INDEX "Recipe_householdId_createdAt_idx" ON "Recipe"("householdId", "createdAt");
