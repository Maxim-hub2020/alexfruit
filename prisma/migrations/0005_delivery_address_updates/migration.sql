ALTER TABLE "Address" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order" ADD COLUMN "needsLift" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "liftFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE INDEX "Address_userId_isDeleted_idx" ON "Address"("userId", "isDeleted");
