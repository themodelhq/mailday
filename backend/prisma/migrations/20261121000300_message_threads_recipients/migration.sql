ALTER TABLE "Message" ADD COLUMN "cc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Message" ADD COLUMN "bcc" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Message" ADD COLUMN "threadId" TEXT;
ALTER TABLE "Message" ADD COLUMN "inReplyTo" TEXT;
CREATE INDEX "Message_ownerId_threadId_idx" ON "Message"("ownerId", "threadId");
