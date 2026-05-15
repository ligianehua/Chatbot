-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appleUserId" TEXT,
ADD COLUMN     "googleUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_appleUserId_key" ON "User"("appleUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleUserId_key" ON "User"("googleUserId");
