-- Household share-link + claim model
ALTER TABLE "Household"
  ADD COLUMN "shareTokenHash" TEXT,
  ADD COLUMN "shareTokenVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "claimedByUserId" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Household_shareTokenHash_key" ON "Household"("shareTokenHash");

ALTER TABLE "Household"
  ADD CONSTRAINT "Household_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Stable auth-subject linkage for Supabase users
ALTER TABLE "User"
  ADD COLUMN "authProviderUserId" TEXT;

CREATE UNIQUE INDEX "User_authProviderUserId_key" ON "User"("authProviderUserId");
