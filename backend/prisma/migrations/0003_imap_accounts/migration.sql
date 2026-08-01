-- CreateTable
CREATE TABLE "ImapAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImapAccount_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ImapAccount" ADD CONSTRAINT "ImapAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- CreateIndex
CREATE INDEX "ImapAccount_userId_idx" ON "ImapAccount"("userId");
