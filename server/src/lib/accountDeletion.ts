import fs from "fs";
import path from "path";
import { prisma } from "./prisma";
import { recalcBeerTaste } from "./crowdTaste";
import { forgetChatMembers, sendToUsers } from "./realtime";
import { UPLOADS_DIR } from "../routes/uploads";

/**
 * Полностью удаляет аккаунт: профиль, отзывы, сканы, вишлист, посты и комментарии, лайки, дружбу, сообщения и
 * загруженные файлы. Личные переписки удаляются целиком (у собеседника тоже). Из групп человек просто выходит:
 * его сообщения стираются, а если он был владельцем, группу берёт самый давний участник.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: { conversation: { include: { members: { orderBy: { joinedAt: "asc" } } } } },
  });
  const reviewed = await prisma.review.findMany({ where: { userId }, select: { beerId: true } });

  const notify: { chatId: string; userIds: string[] }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const { conversation } of memberships) {
      const others = conversation.members.filter((m) => m.userId !== userId);
      if (conversation.type === "direct" || others.length === 0) {
        await tx.conversation.delete({ where: { id: conversation.id } }); // сообщения и участники — каскадом
      } else {
        const me = conversation.members.find((m) => m.userId === userId);
        if (me?.role === "owner" && !others.some((m) => m.role === "owner")) {
          await tx.conversationMember.update({
            where: { conversationId_userId: { conversationId: conversation.id, userId: others[0].userId } },
            data: { role: "owner" },
          });
        }
      }
      notify.push({ chatId: conversation.id, userIds: others.map((m) => m.userId) });
    }

    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.conversationMember.deleteMany({ where: { userId } });
    await tx.commentLike.deleteMany({ where: { userId } });
    await tx.postLike.deleteMany({ where: { userId } });
    await tx.comment.deleteMany({ where: { userId } }); // ответы других людей на эти комментарии уходят каскадом
    await tx.post.deleteMany({ where: { userId } }); // лайки и комментарии под постами — каскадом
    await tx.review.deleteMany({ where: { userId } });
    await tx.scanHistory.deleteMany({ where: { userId } });
    await tx.wishlist.deleteMany({ where: { userId } });
    await tx.report.deleteMany({ where: { reporterId: userId } });
    await tx.friendship.deleteMany({ where: { OR: [{ userId }, { friendId: userId }] } });
    await tx.user.delete({ where: { id: userId } });
  });

  // Всё, что нельзя откатить транзакцией, делаем после неё.
  await fs.promises.rm(path.join(UPLOADS_DIR, userId), { recursive: true, force: true });
  for (const beerId of new Set(reviewed.map((r) => r.beerId))) await recalcBeerTaste(beerId); // голоса человека больше не считаются
  for (const { chatId, userIds } of notify) {
    forgetChatMembers(chatId);
    sendToUsers(userIds, { type: "chat", chatId });
  }
}
