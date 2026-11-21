ALTER TYPE "OutboundStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';

CREATE TABLE "OutboundDeliveryEvent" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT,
  "recipient" TEXT,
  "detail" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboundDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutboundDeliveryEvent_provider_providerEventId_key"
  ON "OutboundDeliveryEvent"("provider", "providerEventId");
CREATE INDEX "OutboundDeliveryEvent_deliveryId_occurredAt_idx"
  ON "OutboundDeliveryEvent"("deliveryId", "occurredAt");
ALTER TABLE "OutboundDeliveryEvent"
  ADD CONSTRAINT "OutboundDeliveryEvent_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "OutboundDelivery"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
