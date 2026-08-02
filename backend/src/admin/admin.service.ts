import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async stats() {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [totalUsers, totalMessages, byMailbox, admins, activeToday] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.message.count(),
      this.prisma.message.groupBy({ by: ['mailbox'], _count: { _all: true } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
      totalUsers,
      totalMessages,
      admins,
      activeToday,
      byMailbox: Object.fromEntries(byMailbox.map((g) => [g.mailbox, g._count._all])),
    };
  }

  async listUsers(page: number, limit: number, search?: string) {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async updateUser(id: string, role?: 'USER' | 'ADMIN', isActive?: boolean) {
    await this.ensureUser(id);
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      select: { id: true, email: true, username: true, displayName: true, role: true, isActive: true },
    });
  }

  async removeUser(id: string) {
    await this.ensureUser(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async listMessages(page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          ownerId: true,
          mailbox: true,
          from: true,
          to: true,
          subject: true,
          snippet: true,
          isRead: true,
          sentAt: true,
        },
      }),
      this.prisma.message.count(),
    ]);
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  private async ensureUser(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('User not found');
  }
}
