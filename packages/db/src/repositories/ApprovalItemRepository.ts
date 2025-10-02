import { PrismaClient, ApprovalItem, ApprovalItemStatus, Prisma } from '@prisma/client';

export class ApprovalItemRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: Prisma.ApprovalItemCreateInput): Promise<ApprovalItem> {
    return this.prisma.approvalItem.create({
      data,
      include: {
        approval: true,
        previewItem: true,
      },
    });
  }

  async createMany(
    data: Prisma.ApprovalItemCreateManyInput[]
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.approvalItem.createMany({
      data,
    });
  }

  async findById(id: string): Promise<ApprovalItem | null> {
    return this.prisma.approvalItem.findUnique({
      where: { id },
      include: {
        approval: {
          include: {
            user: true,
            preview: true,
          },
        },
        previewItem: true,
      },
    });
  }

  async findByApprovalId(approvalId: string): Promise<ApprovalItem[]> {
    return this.prisma.approvalItem.findMany({
      where: { approvalId },
      include: {
        previewItem: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByPreviewItemId(previewItemId: string): Promise<ApprovalItem | null> {
    return this.prisma.approvalItem.findUnique({
      where: { previewItemId },
      include: {
        approval: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Prisma.ApprovalItemUpdateInput
  ): Promise<ApprovalItem> {
    return this.prisma.approvalItem.update({
      where: { id },
      data,
      include: {
        approval: true,
        previewItem: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: ApprovalItemStatus,
    reason?: string,
    modifiedData?: any
  ): Promise<ApprovalItem> {
    return this.prisma.approvalItem.update({
      where: { id },
      data: {
        status,
        reason,
        modifiedData,
        updatedAt: new Date(),
      },
      include: {
        approval: true,
        previewItem: true,
      },
    });
  }

  async bulkUpdateStatus(
    ids: string[],
    status: ApprovalItemStatus,
    reason?: string
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.approvalItem.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status,
        reason,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.approvalItem.delete({
      where: { id },
    });
  }

  async deleteMany(approvalId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.approvalItem.deleteMany({
      where: { approvalId },
    });
  }

  async findByStatus(
    status: ApprovalItemStatus,
    approvalId?: string
  ): Promise<ApprovalItem[]> {
    const where: Prisma.ApprovalItemWhereInput = { status };
    if (approvalId) {
      where.approvalId = approvalId;
    }

    return this.prisma.approvalItem.findMany({
      where,
      include: {
        approval: {
          include: {
            user: true,
            preview: true,
          },
        },
        previewItem: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findModifiedItems(approvalId?: string): Promise<ApprovalItem[]> {
    const where: Prisma.ApprovalItemWhereInput = {
      status: ApprovalItemStatus.MODIFIED,
      modifiedData: {
        not: Prisma.JsonNull,
      },
    };
    if (approvalId) {
      where.approvalId = approvalId;
    }

    return this.prisma.approvalItem.findMany({
      where,
      include: {
        approval: {
          include: {
            user: true,
            preview: true,
          },
        },
        previewItem: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}