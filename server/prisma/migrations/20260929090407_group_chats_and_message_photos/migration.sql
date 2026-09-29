-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "directKey" TEXT
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,

    PRIMARY KEY ("conversationId", "userId"),
    CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Перенос прежней переписки: на каждую пару людей создаём один личный чат.
CREATE TEMP TABLE "_pairs" AS
SELECT MIN("senderId", "recipientId") AS a,
       MAX("senderId", "recipientId") AS b,
       'c' || lower(hex(randomblob(11))) AS cid,
       MIN("createdAt") AS created,
       MAX("createdAt") AS last
FROM "Message"
GROUP BY 1, 2;

INSERT INTO "Conversation" ("id", "type", "title", "createdById", "createdAt", "lastMessageAt", "directKey")
SELECT cid, 'direct', NULL, NULL, created, last, a || ':' || b FROM "_pairs";

-- Прочитанное раньше (readAt) превращается в отметку «прочитано до» у получателя.
INSERT INTO "ConversationMember" ("conversationId", "userId", "role", "joinedAt", "lastReadAt")
SELECT p.cid, p.a, 'member', p.created,
       (SELECT MAX(m."readAt") FROM "Message" m WHERE m."recipientId" = p.a AND m."senderId" = p.b)
FROM "_pairs" p
UNION ALL
SELECT p.cid, p.b, 'member', p.created,
       (SELECT MAX(m."readAt") FROM "Message" m WHERE m."recipientId" = p.b AND m."senderId" = p.a)
FROM "_pairs" p;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'user',
    "text" TEXT,
    "beerId" TEXT,
    "photoUrl" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_beerId_fkey" FOREIGN KEY ("beerId") REFERENCES "Beer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("id", "conversationId", "senderId", "kind", "text", "beerId", "createdAt")
SELECT o."id", p.cid, o."senderId", 'user', o."text", o."beerId", o."createdAt"
FROM "Message" o
JOIN "_pairs" p ON p.a = MIN(o."senderId", o."recipientId") AND p.b = MAX(o."senderId", o."recipientId");
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

DROP TABLE "_pairs";

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");
