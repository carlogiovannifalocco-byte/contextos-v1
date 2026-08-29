-- CreateEnum
CREATE TYPE "MemoryRelationKind" AS ENUM ('supersedes', 'contradicts', 'references', 'parent_of');

-- AlterTable
ALTER TABLE "MemoryEntry" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "sourcePath" TEXT;

-- CreateTable
CREATE TABLE "MemoryRelation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" "MemoryRelationKind" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryRelation_projectId_kind_idx" ON "MemoryRelation"("projectId", "kind");

-- CreateIndex
CREATE INDEX "MemoryRelation_toId_idx" ON "MemoryRelation"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryRelation_fromId_toId_kind_key" ON "MemoryRelation"("fromId", "toId", "kind");

-- AddForeignKey
ALTER TABLE "MemoryRelation" ADD CONSTRAINT "MemoryRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRelation" ADD CONSTRAINT "MemoryRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "MemoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
