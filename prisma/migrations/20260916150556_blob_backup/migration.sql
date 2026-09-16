-- CreateTable
CREATE TABLE "BlobBackup" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlobBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlobBackup_sourceUrl_key" ON "BlobBackup"("sourceUrl");
