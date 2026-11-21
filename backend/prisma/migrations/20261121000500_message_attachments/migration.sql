CREATE TABLE "Attachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Attachment_storageName_key" ON "Attachment"("storageName");
CREATE INDEX "Attachment_messageId_createdAt_idx" ON "Attachment"("messageId", "createdAt");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
