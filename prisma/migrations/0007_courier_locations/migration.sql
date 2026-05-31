-- Current courier location is stored separately from orders so old orders keep
-- their historical delivery data unchanged.
CREATE TABLE "CourierLocation" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourierLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourierLocation_courierId_key" ON "CourierLocation"("courierId");
CREATE INDEX "CourierLocation_updatedAt_idx" ON "CourierLocation"("updatedAt");

ALTER TABLE "CourierLocation"
ADD CONSTRAINT "CourierLocation_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
