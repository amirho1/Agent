-- CreateTable
CREATE TABLE "ReadResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "hotelId" TEXT,
    "matchedRowsCount" INTEGER NOT NULL,
    "columnsJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "toolCallsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadResult_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadResult_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReadResult_agentRunId_key" ON "ReadResult"("agentRunId");

-- CreateIndex
CREATE INDEX "ReadResult_chatId_createdAt_idx" ON "ReadResult"("chatId", "createdAt");
