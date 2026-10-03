-- AlterTable
ALTER TABLE "Beer" ADD COLUMN     "tasteBase" TEXT,
ADD COLUMN     "tasteVotes" INTEGER NOT NULL DEFAULT 0;
