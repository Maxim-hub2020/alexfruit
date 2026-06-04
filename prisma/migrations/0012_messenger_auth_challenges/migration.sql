-- CreateEnum
CREATE TYPE "MessengerAuthProvider" AS ENUM ('TELEGRAM', 'MAX');

-- CreateEnum
CREATE TYPE "MessengerAuthStatus" AS ENUM ('PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "MessengerAuthChallenge" (
    "id" TEXT NOT NULL,
    "provider" "MessengerAuthProvider" NOT NULL,
    "phone" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "MessengerAuthStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT,
    "messengerUserId" TEXT,
    "messengerChatId" TEXT,
    "contactPhone" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessengerAuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessengerAuthChallenge_tokenHash_key" ON "MessengerAuthChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "MessengerAuthChallenge_provider_phone_status_idx" ON "MessengerAuthChallenge"("provider", "phone", "status");

-- CreateIndex
CREATE INDEX "MessengerAuthChallenge_provider_messengerChatId_status_idx" ON "MessengerAuthChallenge"("provider", "messengerChatId", "status");

-- CreateIndex
CREATE INDEX "MessengerAuthChallenge_expiresAt_idx" ON "MessengerAuthChallenge"("expiresAt");

-- AddForeignKey
ALTER TABLE "MessengerAuthChallenge" ADD CONSTRAINT "MessengerAuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
