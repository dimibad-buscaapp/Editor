-- CreateEnum
CREATE TYPE "MemoryNodeKind" AS ENUM ('decision', 'file', 'intent');

-- CreateTable
CREATE TABLE "MemoryNode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "MemoryNodeKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "filePath" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "state" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mode" TEXT,
    "request" JSONB NOT NULL,
    "plan" JSONB NOT NULL DEFAULT '[]',
    "content" TEXT NOT NULL DEFAULT '',
    "thinkingLog" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "response" JSONB,
    "segment" TEXT,
    "composerPlan" JSONB,
    "approvalStatus" TEXT,
    "appliedPaths" JSONB,
    "resultSummary" TEXT,
    "compileJobId" TEXT,
    "buildJobId" TEXT,
    "testOutput" TEXT,
    "indexedFiles" INTEGER,
    "actionPhase" TEXT,
    "skipPostApply" BOOLEAN NOT NULL DEFAULT false,
    "reviewerReport" JSONB,
    "planDag" JSONB,
    "swarmJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwarmJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "prompt" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "graph" JSONB NOT NULL,
    "concurrency" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwarmJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwarmSubJob" (
    "id" TEXT NOT NULL,
    "swarmJobId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "dependsOn" JSONB NOT NULL DEFAULT '[]',
    "worktreePath" TEXT,
    "agentJobId" TEXT,
    "request" JSONB,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwarmSubJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemoryNode_workspaceId_idx" ON "MemoryNode"("workspaceId");
CREATE INDEX "MemoryNode_workspaceId_kind_idx" ON "MemoryNode"("workspaceId", "kind");
CREATE INDEX "AgentJob_status_idx" ON "AgentJob"("status");
CREATE INDEX "AgentJob_workspaceId_idx" ON "AgentJob"("workspaceId");
CREATE INDEX "AgentJob_swarmJobId_idx" ON "AgentJob"("swarmJobId");
CREATE INDEX "SwarmJob_status_idx" ON "SwarmJob"("status");
CREATE INDEX "SwarmSubJob_swarmJobId_idx" ON "SwarmSubJob"("swarmJobId");
CREATE INDEX "SwarmSubJob_status_idx" ON "SwarmSubJob"("status");

-- AddForeignKey
ALTER TABLE "SwarmSubJob" ADD CONSTRAINT "SwarmSubJob_swarmJobId_fkey" FOREIGN KEY ("swarmJobId") REFERENCES "SwarmJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
