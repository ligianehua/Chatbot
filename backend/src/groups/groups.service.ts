import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, FriendshipStatus, GroupRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

const MAX_GROUP_SIZE = 200;

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a group + its backing conversation atomically. All invited members
   * must be accepted friends of the creator. The conversation is created with
   * the same member set as the group so existing chat fanout works unchanged.
   */
  async create(creatorId: string, dto: CreateGroupDto) {
    const ids = Array.from(new Set(dto.memberIds.filter((id) => id !== creatorId)));
    if (ids.length === 0) throw new BadRequestException('add at least 1 friend');
    if (ids.length + 1 > MAX_GROUP_SIZE) {
      throw new BadRequestException(`group capped at ${MAX_GROUP_SIZE} members`);
    }

    const friendships = await this.prisma.friendship.findMany({
      where: {
        userId: creatorId,
        friendId: { in: ids },
        status: FriendshipStatus.accepted,
      },
    });
    if (friendships.length !== ids.length) {
      throw new BadRequestException('all invitees must be accepted friends');
    }

    return this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          ownerId: creatorId,
          name: dto.name,
          avatarUrl: dto.avatarUrl,
          memberCount: ids.length + 1,
          members: {
            createMany: {
              data: [
                { userId: creatorId, role: GroupRole.owner },
                ...ids.map((uid) => ({ userId: uid, role: GroupRole.member })),
              ],
            },
          },
        },
      });
      await tx.conversation.create({
        data: {
          type: ConversationType.group,
          peerId: group.id,
          members: {
            createMany: {
              data: [{ userId: creatorId }, ...ids.map((uid) => ({ userId: uid }))],
            },
          },
        },
      });
      return group;
    });
  }

  async listMine(userId: string) {
    return this.prisma.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
      },
    });
    if (!group) throw new NotFoundException('group not found');
    if (!group.members.some((m) => m.userId === userId)) {
      throw new ForbiddenException('not a group member');
    }
    return group;
  }

  async update(userId: string, groupId: string, dto: UpdateGroupDto) {
    await this.requireRoleAtLeast(userId, groupId, GroupRole.admin);
    return this.prisma.group.update({ where: { id: groupId }, data: dto });
  }

  async disband(userId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('group not found');
    if (group.ownerId !== userId) throw new ForbiddenException('only owner can disband');
    await this.prisma.$transaction(async (tx) => {
      await tx.conversation.deleteMany({
        where: { type: ConversationType.group, peerId: groupId },
      });
      await tx.group.delete({ where: { id: groupId } });
    });
  }

  async addMembers(userId: string, groupId: string, dto: AddMembersDto) {
    await this.requireRoleAtLeast(userId, groupId, GroupRole.admin);

    const existing = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { in: dto.userIds } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const fresh = dto.userIds.filter((id) => !existingIds.has(id));
    if (fresh.length === 0) return { added: 0 };

    // Inviter must be friends with all newcomers.
    const friendships = await this.prisma.friendship.findMany({
      where: {
        userId,
        friendId: { in: fresh },
        status: FriendshipStatus.accepted,
      },
    });
    if (friendships.length !== fresh.length) {
      throw new BadRequestException('all invitees must be your friends');
    }

    const conv = await this.prisma.conversation.findFirst({
      where: { type: ConversationType.group, peerId: groupId },
    });
    if (!conv) throw new NotFoundException('backing conversation missing');

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.createMany({
        data: fresh.map((uid) => ({ groupId, userId: uid })),
        skipDuplicates: true,
      });
      await tx.conversationMember.createMany({
        data: fresh.map((uid) => ({ conversationId: conv.id, userId: uid })),
        skipDuplicates: true,
      });
      await tx.group.update({
        where: { id: groupId },
        data: { memberCount: { increment: fresh.length } },
      });
    });
    return { added: fresh.length };
  }

  /**
   * Self-leave (userId === targetUserId) or kick (admin-only, cannot kick owner).
   * Owner must transfer or disband instead of leaving.
   */
  async removeMember(userId: string, groupId: string, targetUserId: string) {
    const me = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!me) throw new ForbiddenException('not a group member');

    const target = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('target not in group');

    const isSelf = userId === targetUserId;
    if (!isSelf) {
      if (me.role === GroupRole.member) throw new ForbiddenException('admin required');
      if (target.role === GroupRole.owner) throw new ForbiddenException('cannot kick owner');
    } else if (target.role === GroupRole.owner) {
      throw new BadRequestException('owner must transfer or disband');
    }

    const conv = await this.prisma.conversation.findFirst({
      where: { type: ConversationType.group, peerId: groupId },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: { groupId_userId: { groupId, userId: targetUserId } },
      });
      if (conv) {
        await tx.conversationMember.deleteMany({
          where: { conversationId: conv.id, userId: targetUserId },
        });
      }
      await tx.group.update({
        where: { id: groupId },
        data: { memberCount: { decrement: 1 } },
      });
    });
  }

  async openConversation(userId: string, groupId: string) {
    await this.requireMember(userId, groupId);
    const conv = await this.prisma.conversation.findFirst({
      where: { type: ConversationType.group, peerId: groupId },
    });
    if (!conv) throw new NotFoundException('group conversation missing');
    return conv;
  }

  // ----- helpers -----

  private async requireMember(userId: string, groupId: string) {
    const m = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!m) throw new ForbiddenException('not a group member');
    return m;
  }

  private async requireRoleAtLeast(userId: string, groupId: string, role: GroupRole) {
    const m = await this.requireMember(userId, groupId);
    const rank = { member: 0, admin: 1, owner: 2 } as const;
    if (rank[m.role] < rank[role]) throw new ForbiddenException(`requires ${role}+`);
    return m;
  }
}
