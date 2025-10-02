import { type PrismaClient, type AutomationRun, type AutomationStep, AutomationStatus, type Prisma } from '@prisma/client';

export interface AutomationRunWithSteps extends AutomationRun {
  steps: AutomationStep[];
}

export interface CreateAutomationRunInput {
  ticketId: string;
  status: AutomationStatus;
  metadata: Prisma.InputJsonValue;
}

export interface UpdateAutomationRunInput {
  status?: AutomationStatus;
  metadata?: Prisma.InputJsonValue;
  error?: string | null;
  completedAt?: Date | null;
}

export class AutomationRunRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateAutomationRunInput): Promise<AutomationRun> {
    return this.prisma.automationRun.create({
      data,
    });
  }

  async findById(id: string): Promise<AutomationRun | null> {
    return this.prisma.automationRun.findUnique({
      where: { id },
    });
  }

  async findByIdWithSteps(id: string): Promise<AutomationRunWithSteps | null> {
    return this.prisma.automationRun.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
  }

  async findByTicketId(ticketId: string): Promise<AutomationRun[]> {
    return this.prisma.automationRun.findMany({
      where: { ticketId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findByStatus(status: AutomationStatus): Promise<AutomationRun[]> {
    return this.prisma.automationRun.findMany({
      where: { status },
      orderBy: { startedAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateAutomationRunInput): Promise<AutomationRun> {
    return this.prisma.automationRun.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automationRun.delete({
      where: { id },
    });
  }

  async findWithPagination(
    where: Prisma.AutomationRunWhereInput,
    limit: number,
    offset: number
  ): Promise<{ runs: AutomationRun[]; total: number }> {
    const [runs, total] = await Promise.all([
      this.prisma.automationRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.automationRun.count({ where }),
    ]);

    return { runs, total };
  }

  async markAsCompleted(
    id: string,
    status: 'SUCCESS' | 'FAILED' | 'PARTIAL',
    error?: string
  ): Promise<AutomationRun> {
    return this.update(id, {
      status: status as AutomationStatus,
      error: error || null,
      completedAt: new Date(),
    });
  }

  async getLatestRunForTicket(ticketId: string): Promise<AutomationRun | null> {
    return this.prisma.automationRun.findFirst({
      where: { ticketId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async countByStatus(status: AutomationStatus): Promise<number> {
    return this.prisma.automationRun.count({
      where: { status },
    });
  }

  async getRunningRuns(): Promise<AutomationRun[]> {
    return this.prisma.automationRun.findMany({
      where: { status: 'RUNNING' as AutomationStatus },
      orderBy: { startedAt: 'asc' },
    });
  }

  async cleanupOldRuns(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.automationRun.deleteMany({
      where: {
        completedAt: {
          lt: cutoffDate,
        },
        status: {
          in: ['SUCCESS', 'FAILED', 'PARTIAL'] as AutomationStatus[],
        },
      },
    });

    return result.count;
  }
}
