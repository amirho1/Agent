-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UploadedFile_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UploadedFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AgentRun_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "detailJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentStep_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentStep_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "resultSummary" TEXT NOT NULL,
    "resultJson" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolCall_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ToolCall_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "affectedRowsCount" INTEGER NOT NULL,
    "assumptionsJson" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL,
    "diffsJson" TEXT NOT NULL,
    "pmsPayloadJson" TEXT NOT NULL,
    "toolCallsJson" TEXT NOT NULL,
    "oldValuesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionProposal_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActionProposal_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionProposalId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultJson" TEXT,
    "conflictJson" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionExecution_actionProposalId_fkey" FOREIGN KEY ("actionProposalId") REFERENCES "ActionProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "UploadedFile_chatId_createdAt_idx" ON "UploadedFile"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_chatId_createdAt_idx" ON "AgentRun"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentStep_chatId_order_idx" ON "AgentStep"("chatId", "order");

-- CreateIndex
CREATE INDEX "AgentStep_agentRunId_order_idx" ON "AgentStep"("agentRunId", "order");

-- CreateIndex
CREATE INDEX "ToolCall_chatId_createdAt_idx" ON "ToolCall"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ToolCall_agentRunId_createdAt_idx" ON "ToolCall"("agentRunId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionProposal_agentRunId_key" ON "ActionProposal"("agentRunId");

-- CreateIndex
CREATE INDEX "ActionProposal_chatId_createdAt_idx" ON "ActionProposal"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionProposal_status_createdAt_idx" ON "ActionProposal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ActionExecution_actionProposalId_createdAt_idx" ON "ActionExecution"("actionProposalId", "createdAt");
