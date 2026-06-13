ALTER TABLE "MessengerAuthChallenge"
ADD COLUMN "returnTokenHash" TEXT,
ADD COLUMN "returnTokenUsedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "MessengerAuthChallenge_returnTokenHash_key"
ON "MessengerAuthChallenge"("returnTokenHash");
