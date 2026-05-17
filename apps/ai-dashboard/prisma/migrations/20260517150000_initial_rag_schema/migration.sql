CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant', 'system');
CREATE TYPE "EmbeddingJobStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

CREATE TABLE "User" (
	"id" TEXT NOT NULL,
	"email" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"passwordHash" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
	"tokenHash" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"expiresAt" TIMESTAMP(3) NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "Workspace" (
	"id" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"name" TEXT NOT NULL,
	"rootPath" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceFile" (
	"id" TEXT NOT NULL,
	"workspaceId" TEXT NOT NULL,
	"path" TEXT NOT NULL,
	"contentHash" TEXT,
	"size" INTEGER NOT NULL DEFAULT 0,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "WorkspaceFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatSession" (
	"id" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"workspaceId" TEXT,
	"title" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatMessage" (
	"id" TEXT NOT NULL,
	"sessionId" TEXT NOT NULL,
	"role" "ChatRole" NOT NULL,
	"content" TEXT NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileEmbeddingJob" (
	"id" TEXT NOT NULL,
	"workspaceId" TEXT NOT NULL,
	"filePath" TEXT NOT NULL,
	"chunkCount" INTEGER NOT NULL DEFAULT 0,
	"status" "EmbeddingJobStatus" NOT NULL DEFAULT 'queued',
	"error" TEXT,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "FileEmbeddingJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileChunk" (
	"id" TEXT NOT NULL,
	"workspaceId" TEXT NOT NULL,
	"filePath" TEXT NOT NULL,
	"chunkIndex" INTEGER NOT NULL,
	"content" TEXT NOT NULL,
	"contentHash" TEXT NOT NULL,
	"embedding" vector NOT NULL,
	"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" TIMESTAMP(3) NOT NULL,

	CONSTRAINT "FileChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");
CREATE UNIQUE INDEX "WorkspaceFile_workspaceId_path_key" ON "WorkspaceFile"("workspaceId", "path");
CREATE INDEX "WorkspaceFile_workspaceId_idx" ON "WorkspaceFile"("workspaceId");
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");
CREATE INDEX "ChatSession_workspaceId_idx" ON "ChatSession"("workspaceId");
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
CREATE INDEX "FileEmbeddingJob_workspaceId_idx" ON "FileEmbeddingJob"("workspaceId");
CREATE INDEX "FileEmbeddingJob_status_idx" ON "FileEmbeddingJob"("status");
CREATE UNIQUE INDEX "FileChunk_workspaceId_filePath_chunkIndex_key" ON "FileChunk"("workspaceId", "filePath", "chunkIndex");
CREATE INDEX "FileChunk_workspaceId_idx" ON "FileChunk"("workspaceId");
CREATE INDEX "FileChunk_workspaceId_filePath_idx" ON "FileChunk"("workspaceId", "filePath");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFile" ADD CONSTRAINT "WorkspaceFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileEmbeddingJob" ADD CONSTRAINT "FileEmbeddingJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileChunk" ADD CONSTRAINT "FileChunk_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
