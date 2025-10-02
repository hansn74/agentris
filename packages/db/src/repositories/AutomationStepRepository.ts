import { type PrismaClient, type AutomationStep, Prisma } from '@prisma/client';

export interface CreateAutomationStepInput {
  runId: string;
  stepType: string;
  status: string;
  input: Prisma.InputJsonValue;
  output?: Prisma.InputJsonValue | null;
  error?: string | null;
  startedAt?: Date;
  completedAt?: Date | null;
}

export interface UpdateAutomationStepInput {
  status?: string;
  output?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  error?: string | null;
  completedAt?: Date | null;
}

export class AutomationStepRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateAutomationStepInput): Promise<AutomationStep> {
    return this.prisma.automationStep.create({
      data: {
        runId: data.runId,
        stepType: data.stepType,
        status: data.status,
        input: data.input as Prisma.InputJsonValue,
        output: data.output !== undefined ? (data.output as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput) : Prisma.DbNull,
        error: data.error || null,
        startedAt: data.startedAt || new Date(),
        completedAt: data.completedAt || null,
      },
    });
  }

  async findById(id: string): Promise<AutomationStep | null> {
    return this.prisma.automationStep.findUnique({
      where: { id },
    });
  }

  async findByRunId(runId: string): Promise<AutomationStep[]> {
    return this.prisma.automationStep.findMany({
      where: { runId },
      orderBy: { startedAt: 'asc' },
    });
  }

  async findByRunIdAndType(runId: string, stepType: string): Promise<AutomationStep[]> {
    return this.prisma.automationStep.findMany({
      where: {
        runId,
        stepType,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateAutomationStepInput): Promise<AutomationStep> {
    return this.prisma.automationStep.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automationStep.delete({
      where: { id },
    });
  }

  async deleteByRunId(runId: string): Promise<number> {
    const result = await this.prisma.automationStep.deleteMany({
      where: { runId },
    });
    return result.count;
  }

  async getLatestStepForRun(runId: string): Promise<AutomationStep | null> {
    return this.prisma.automationStep.findFirst({
      where: { runId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getRunningSteps(runId: string): Promise<AutomationStep[]> {
    return this.prisma.automationStep.findMany({
      where: {
        runId,
        status: 'RUNNING',
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  async markAsCompleted(
    id: string,
    status: 'COMPLETED' | 'FAILED',
    output?: Prisma.InputJsonValue,
    error?: string
  ): Promise<AutomationStep> {
    return this.update(id, {
      status,
      output: output !== undefined ? output : Prisma.DbNull,
      error: error || null,
      completedAt: new Date(),
    });
  }

  async recordStep(
    runId: string,
    stepType: string,
    status: string,
    input: Prisma.InputJsonValue,
    output?: Prisma.InputJsonValue
  ): Promise<AutomationStep> {
    return this.create({
      runId,
      stepType,
      status,
      input,
      output: output !== undefined ? output : null,
      startedAt: status === 'RUNNING' ? new Date() : undefined,
      completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : null,
    });
  }

  async getStepDuration(id: string): Promise<number | null> {
    const step = await this.findById(id);
    if (!step || !step.startedAt || !step.completedAt) {
      return null;
    }
    return step.completedAt.getTime() - step.startedAt.getTime();
  }

  async getAverageStepDuration(stepType: string): Promise<number> {
    const steps = await this.prisma.automationStep.findMany({
      where: {
        stepType,
        startedAt: { not: null },
        completedAt: { not: null },
      },
    });

    if (steps.length === 0) {
      return 0;
    }

    const totalDuration = steps.reduce((sum, step) => {
      if (step.startedAt && step.completedAt) {
        return sum + (step.completedAt.getTime() - step.startedAt.getTime());
      }
      return sum;
    }, 0);

    return totalDuration / steps.length;
  }

  async getStepSuccessRate(stepType: string): Promise<number> {
    const [total, successful] = await Promise.all([
      this.prisma.automationStep.count({
        where: { stepType },
      }),
      this.prisma.automationStep.count({
        where: {
          stepType,
          status: 'COMPLETED',
        },
      }),
    ]);

    if (total === 0) {
      return 0;
    }

    return (successful / total) * 100;
  }
}
