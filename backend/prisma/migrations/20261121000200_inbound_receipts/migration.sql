CREATE TABLE "InboundReceipt" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'webhook',
  "providerMessageId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "messageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "InboundReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboundReceipt_provider_providerMessageId_recipient_key" ON "InboundReceipt"("provider", "providerMessageId", "recipient");
CREATE INDEX "InboundReceipt_ownerId_receivedAt_idx" ON "InboundReceipt"("ownerId", "receivedAt");
CREATE INDEX "InboundReceipt_status_receivedAt_idx" ON "InboundReceipt"("status", "receivedAt");
ALTER TABLE "InboundReceipt" ADD CONSTRAINT "InboundReceipt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
