CREATE TABLE "DailyInventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantityStart" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quantitySold" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyInventory_productId_date_key" ON "DailyInventory"("productId", "date");
CREATE INDEX "DailyInventory_date_idx" ON "DailyInventory"("date");
CREATE INDEX "DailyInventory_productId_idx" ON "DailyInventory"("productId");

ALTER TABLE "DailyInventory"
ADD CONSTRAINT "DailyInventory_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
