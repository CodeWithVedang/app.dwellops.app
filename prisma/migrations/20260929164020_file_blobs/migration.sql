-- CreateTable
CREATE TABLE "file_blobs" (
    "key" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_blobs_pkey" PRIMARY KEY ("key")
);
