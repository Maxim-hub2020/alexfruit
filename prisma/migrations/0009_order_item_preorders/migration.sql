ALTER TABLE "OrderItem"
ADD COLUMN "reservedQuantity" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "isPreorder" BOOLEAN NOT NULL DEFAULT false;

UPDATE "OrderItem"
SET "reservedQuantity" = "orderedQuantity";
