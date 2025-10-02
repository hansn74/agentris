import { PrismaClient, Approval, ApprovalStatus, Prisma } from '@prisma/client';

export class ApprovalRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.ApprovalCreateInput): Promise<Approval> {
    return this.prisma.approval.create({
      data,
      include: {
        items: true,
        preview: true,
        user: true,
      },
    });
  }

  async findById(id: string): Promise<Approval | null> {
    return this.prisma.approval.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        preview: {
          include: {
            items: true,
            ticket: true,
          },
        },
        user: true,
      },
    });
  }

  async findByPreviewId(previewId: string): Promise<Approval[]> {
    return this.prisma.approval.findMany({
      where: { previewId },
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserId(userId: string): Promise<Approval[]> {
    return this.prisma.approval.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        preview: {
          include: {
            ticket: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPending(): Promise<Approval[]> {
    return this.prisma.approval.findMany({
      where: { status: ApprovalStatus.PENDING },
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        preview: {
          include: {
            ticket: true,
          },
        },
        user: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(
    id: string,
    data: Prisma.ApprovalUpdateInput
  ): Promise<Approval> {
    return this.prisma.approval.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        preview: {
          include: {
            ticket: true,
          },
        },
        user: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: ApprovalStatus,
    comments?: string
  ): Promise<Approval> {
    return this.prisma.approval.update({
      where: { id },
      data: {
        status,
        comments,
        updatedAt: new Date(),
      },
      include: {
        items: {
          include: {
            previewItem: true,
          },
        },
        preview: {
          include: {
            ticket: true,
          },
        },
        user: true,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.approval.delete({
      where: { id },
    });
  }

  async getApprovalHistory(
    filters?: {
      userId?: string;
      previewId?: string;
      status?: ApprovalStatus;
      startDate?: Date;
      endDate?: Date;
    },
    pagination?: {
      skip?: number;
      take?: number;
    }
  ): Promise<{ approvals: Approval[]; total: number }> {
    const where: Prisma.ApprovalWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.previewId) {
      where.previewId = filters.previewId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [approvals, total] = await Promise.all([
      this.prisma.approval.findMany({
        where,
        include: {
          items: {
            include: {
              previewItem: true,
            },
          },
          preview: {
            include: {
              ticket: true,
            },
          },
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: pagination?.skip,
        take: pagination?.take,
      }),
      this.prisma.approval.count({ where }),
    ]);

    return { approvals, total };
  }
}