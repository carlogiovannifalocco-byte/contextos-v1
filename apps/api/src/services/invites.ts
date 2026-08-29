import { prisma } from "@contextos/db";

/** Turn pending email invites into memberships when someone registers. */
export async function acceptPendingInvites(userId: string, email: string): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.projectInvite.findMany({ where: { email: normalized } });
  if (pending.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const invite of pending) {
      const project = await tx.project.findUnique({ where: { id: invite.projectId }, select: { ownerId: true } });
      if (!project || project.ownerId === userId) {
        await tx.projectInvite.delete({ where: { id: invite.id } });
        continue;
      }
      const exists = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId: invite.projectId, userId } },
      });
      if (!exists) {
        await tx.projectMember.create({
          data: { projectId: invite.projectId, userId, role: invite.role },
        });
      }
      await tx.projectInvite.delete({ where: { id: invite.id } });
    }
  });

  return pending.length;
}
