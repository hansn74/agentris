import { type PrismaClient, type PreviewItem, type Prisma } from '@prisma/client';

export interface CreatePreviewItemInput {
  previewId: string;
  itemType: string;
  name: string;
  currentState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  proposedState: Prisma.InputJsonValue;
  impact: string;
  description: string;
}

export interface UpdatePreviewItemInput {
  currentState?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  proposedState?: Prisma.InputJsonValue;
  impact?: string;
  description?: string;
}

export interface PreviewItemBulkCreateInput {
  previewId: string;
  items: Omit<CreatePreviewItemInput, 'previewId'>[];
}

export class PreviewItemRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePreviewItemInput): Promise<PreviewItem> {
    return this.prisma.previewItem.create({
      data,
    });
  }

  async createMany(input: PreviewItemBulkCreateInput): Promise<number> {
    const result = await this.prisma.previewItem.createMany({
      data: input.items.map(item => ({
        ...item,
        previewId: input.previewId,
      })),
    });
    return result.count;
  }

  async findById(id: string): Promise<PreviewItem | null> {
    return this.prisma.previewItem.findUnique({
      where: { id },
    });
  }

  async findByPreviewId(previewId: string): Promise<PreviewItem[]> {
    return this.prisma.previewItem.findMany({
      where: { previewId },
      orderBy: [
        { itemType: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findByPreviewIdAndType(previewId: string, itemType: string): Promise<PreviewItem[]> {
    return this.prisma.previewItem.findMany({
      where: {
        previewId,
        itemType,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByImpact(previewId: string, impact: string): Promise<PreviewItem[]> {
    return this.prisma.previewItem.findMany({
      where: {
        previewId,
        impact,
      },
      orderBy: [
        { itemType: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async update(id: string, data: UpdatePreviewItemInput): Promise<PreviewItem> {
    return this.prisma.previewItem.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.previewItem.delete({
      where: { id },
    });
  }

  async deleteByPreviewId(previewId: string): Promise<number> {
    const result = await this.prisma.previewItem.deleteMany({
      where: { previewId },
    });
    return result.count;
  }

  async countByType(previewId: string): Promise<Record<string, number>> {
    const items = await this.prisma.previewItem.groupBy({
      by: ['itemType'],
      where: { previewId },
      _count: {
        itemType: true,
      },
    });

    return items.reduce((acc, item) => {
      acc[item.itemType] = item._count.itemType;
      return acc;
    }, {} as Record<string, number>);
  }

  async countByImpact(previewId: string): Promise<Record<string, number>> {
    const items = await this.prisma.previewItem.groupBy({
      by: ['impact'],
      where: { previewId },
      _count: {
        impact: true,
      },
    });

    return items.reduce((acc, item) => {
      acc[item.impact] = item._count.impact;
      return acc;
    }, {} as Record<string, number>);
  }

  async getHighImpactItems(previewId: string): Promise<PreviewItem[]> {
    return this.prisma.previewItem.findMany({
      where: {
        previewId,
        impact: 'HIGH',
      },
      orderBy: [
        { itemType: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async hasChanges(previewId: string): Promise<boolean> {
    const count = await this.prisma.previewItem.count({
      where: { previewId },
    });
    return count > 0;
  }
}