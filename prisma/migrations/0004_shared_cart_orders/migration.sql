ALTER TABLE "SharedCart"
ADD COLUMN IF NOT EXISTS "orderedAt" TIMESTAMP(3);

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "sharedCartId" TEXT,
ADD COLUMN IF NOT EXISTS "sharedCartTitle" TEXT;

CREATE INDEX IF NOT EXISTS "Order_sharedCartId_idx" ON "Order"("sharedCartId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_sharedCartId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_sharedCartId_fkey"
      FOREIGN KEY ("sharedCartId") REFERENCES "SharedCart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
