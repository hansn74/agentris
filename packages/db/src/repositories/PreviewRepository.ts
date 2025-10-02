import { type PrismaClient, type Preview, type PreviewItem, type Prisma } from '@prisma/client';
import { PreviewFormat, PreviewData } from '@agentris/shared';

export interface PreviewWithItems extends Preview {
  items: PreviewItem[];
}

export interface CreatePreviewInput {
  ticketId: string;
  runId?: string | null;
  status: string;
  metadata: Prisma.InputJsonValue;
  expiresAt: Date;
}

export interface UpdatePreviewInput {
  status?: string;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date;
}

export class PreviewRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreatePreviewInput): Promise<Preview> {
    return this.prisma.preview.create({
      data,
    });
  }

  async findById(id: string): Promise<Preview | null> {
    return this.prisma.preview.findUnique({
      where: { id },
    });
  }

  async findByIdWithItems(id: string): Promise<PreviewWithItems | null> {
    return this.prisma.preview.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { itemType: 'asc' },
        },
      },
    });
  }

  async findByTicketId(ticketId: string): Promise<Preview[]> {
    return this.prisma.preview.findMany({
      where: { ticketId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async findActiveByTicketId(ticketId: string): Promise<Preview | null> {
    return this.prisma.preview.findFirst({
      where: {
        ticketId,
        status: 'READY',
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async findByRunId(runId: string): Promise<Preview | null> {
    return this.prisma.preview.findFirst({
      where: { runId },
      orderBy: { generatedAt: 'desc' },
    });
  }

  async update(id: string, data: UpdatePreviewInput): Promise<Preview> {
    return this.prisma.preview.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.preview.delete({
      where: { id },
    });
  }

  async markAsExpired(id: string): Promise<Preview> {
    return this.update(id, {
      status: 'EXPIRED',
    });
  }

  async markAsReady(id: string): Promise<Preview> {
    return this.update(id, {
      status: 'READY',
    });
  }

  async expireOldPreviews(): Promise<number> {
    const result = await this.prisma.preview.updateMany({
      where: {
        status: 'READY',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return result.count;
  }

  async deleteExpiredPreviews(hoursToKeep: number = 24): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursToKeep);

    const result = await this.prisma.preview.deleteMany({
      where: {
        status: 'EXPIRED',
        expiresAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  async getLatestPreviewForTicket(ticketId: string): Promise<PreviewWithItems | null> {
    return this.prisma.preview.findFirst({
      where: { ticketId },
      orderBy: { generatedAt: 'desc' },
      include: {
        items: {
          orderBy: { itemType: 'asc' },
        },
      },
    });
  }

  async countByStatus(status: string): Promise<number> {
    return this.prisma.preview.count({
      where: { status },
    });
  }

  async createWithPreviewData(data: {
    ticketId: string;
    runId?: string;
    format: PreviewFormat;
    previewData: PreviewData;
    expiresInHours?: number;
  }): Promise<Preview> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (data.expiresInHours ?? 24));

    return this.prisma.preview.create({
      data: {
        ticketId: data.ticketId,
        runId: data.runId,
        status: 'READY',
        metadata: data.previewData as any,
        generatedAt: new Date(),
        expiresAt,
      },
    });
  }

  async createPreviewItems(
    previewId: string,
    items: Array<{
      itemType: string;
      name: string;
      currentState?: any;
      proposedState: any;
      impact: 'LOW' | 'MEDIUM' | 'HIGH';
      description: string;
    }>
  ): Promise<PreviewItem[]> {
    return this.prisma.previewItem.createMany({
      data: items.map(item => ({
        previewId,
        itemType: item.itemType,
        name: item.name,
        currentState: item.currentState as any,
        proposedState: item.proposedState as any,
        impact: item.impact,
        description: item.description,
      })) as any,
    }).then(() => 
      this.prisma.previewItem.findMany({
        where: { previewId },
      })
    );
  }

  async getPreviewWithFormats(ticketId: string): Promise<{
    currentPreview: Preview | null;
    availableFormats: string[];
  }> {
    const preview = await this.findActiveByTicketId(ticketId);
    
    if (!preview) {
      return {
        currentPreview: null,
        availableFormats: [],
      };
    }

    const metadata = preview.metadata as any;
    const availableFormats: string[] = [];
    
    if (metadata?.type) {
      availableFormats.push(metadata.type);
      // Add other formats based on content type
      if (metadata.type === 'diagram') {
        availableFormats.push('text');
      } else if (metadata.type === 'mockup') {
        availableFormats.push('table', 'text');
      } else if (metadata.type === 'code-diff') {
        availableFormats.push('text');
      }
    }

    return {
      currentPreview: preview,
      availableFormats,
    };
  }

  async expirePreviewsForTicket(ticketId: string): Promise<number> {
    const result = await this.prisma.preview.updateMany({
      where: {
        ticketId,
        status: 'READY',
      },
      data: {
        status: 'EXPIRED',
        expiresAt: new Date(),
      },
    });
    return result.count;
  }
}