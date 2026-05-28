-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedCart" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedCartItem" (
    "id" TEXT NOT NULL,
    "sharedCartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" "ProductUnit" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SharedCart_token_key" ON "SharedCart"("token");
CREATE INDEX IF NOT EXISTS "SharedCart_ownerId_createdAt_idx" ON "SharedCart"("ownerId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "SharedCartItem_sharedCartId_productId_addedById_key" ON "SharedCartItem"("sharedCartId", "productId", "addedById");
CREATE INDEX IF NOT EXISTS "SharedCartItem_sharedCartId_createdAt_idx" ON "SharedCartItem"("sharedCartId", "createdAt");
CREATE INDEX IF NOT EXISTS "SharedCartItem_addedById_idx" ON "SharedCartItem"("addedById");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedCart_ownerId_fkey'
  ) THEN
    ALTER TABLE "SharedCart"
      ADD CONSTRAINT "SharedCart_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedCartItem_sharedCartId_fkey'
  ) THEN
    ALTER TABLE "SharedCartItem"
      ADD CONSTRAINT "SharedCartItem_sharedCartId_fkey"
      FOREIGN KEY ("sharedCartId") REFERENCES "SharedCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedCartItem_productId_fkey'
  ) THEN
    ALTER TABLE "SharedCartItem"
      ADD CONSTRAINT "SharedCartItem_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SharedCartItem_addedById_fkey'
  ) THEN
    ALTER TABLE "SharedCartItem"
      ADD CONSTRAINT "SharedCartItem_addedById_fkey"
      FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
