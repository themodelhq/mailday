-- Durable outbound delivery queue
CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'RETRYING', 'FAILED');
ALTER TYPE "MessageState" ADD VALUE IF NOT EXISTS 'QUEUED';
ALTER TYPE "MessageState" ADD VALUE IF NOT EXISTS 'FAILED';

CREATE TABLE "OutboundDelivery" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 8,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "provider" TEXT NOT NULL DEFAULT 'smtp',
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  CONSTRAINT "OutboundDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutboundDelivery_messageId_key" ON "OutboundDelivery"("messageId");
CREATE UNIQUE INDEX "OutboundDelivery_idempotencyKey_key" ON "OutboundDelivery"("idempotencyKey");
CREATE INDEX "OutboundDelivery_status_nextAttemptAt_idx" ON "OutboundDelivery"("status", "nextAttemptAt");
CREATE INDEX "OutboundDelivery_ownerId_createdAt_idx" ON "OutboundDelivery"("ownerId", "createdAt");
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundDelivery" ADD CONSTRAINT "OutboundDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
