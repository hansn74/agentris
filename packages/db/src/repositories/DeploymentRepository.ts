import { PrismaClient, Deployment, DeploymentLog, DeploymentRollback, LogLevel, RollbackStatus } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
export const CreateDeploymentSchema = z.object({
  organizationId: z.string(),
  deploymentId: z.string(),
  status: z.string(),
  metadata: z.any(),
});

export const CreateDeploymentLogSchema = z.object({
  deploymentId: z.string(),
  level: z.nativeEnum(LogLevel),
  message: z.string(),
  metadata: z.any().optional(),
});

export const CreateDeploymentRollbackSchema = z.object({
  deploymentId: z.string(),
  rollbackMetadata: z.any(),
  reason: z.string(),
  initiatedBy: z.string(),
});

export const UpdateDeploymentStatusSchema = z.object({
  deploymentId: z.string(),
  status: z.string(),
  metadata: z.any().optional(),
});

export const UpdateRollbackStatusSchema = z.object({
  rollbackId: z.string(),
  status: z.nativeEnum(RollbackStatus),
  completedAt: z.date().optional(),
  error: z.string().optional(),
});

export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;
export type CreateDeploymentLogInput = z.infer<typeof CreateDeploymentLogSchema>;
export type CreateDeploymentRollbackInput = z.infer<typeof CreateDeploymentRollbackSchema>;
export type UpdateDeploymentStatusInput = z.infer<typeof UpdateDeploymentStatusSchema>;
export type UpdateRollbackStatusInput = z.infer<typeof UpdateRollbackStatusSchema>;

export class DeploymentRepository {
  constructor(private prisma: PrismaClient) {}

  // Deployment CRUD operations
  async createDeployment(data: CreateDeploymentInput): Promise<Deployment> {
    const validated = CreateDeploymentSchema.parse(data);
    return this.prisma.deployment.create({
      data: validated,
      include: {
        organization: true,
      },
    });
  }

  async getDeploymentById(deploymentId: string): Promise<Deployment | null> {
    return this.prisma.deployment.findUnique({
      where: { deploymentId },
      include: {
        organization: true,
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
        rollbacks: true,
      },
    });
  }

  async getDeploymentsByOrganization(organizationId: string): Promise<Deployment[]> {
    return this.prisma.deployment.findMany({
      where: { organizationId },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateDeploymentStatus(data: UpdateDeploymentStatusInput): Promise<Deployment> {
    const validated = UpdateDeploymentStatusSchema.parse(data);
    const updateData: any = {
      status: validated.status,
    };
    
    if (validated.metadata) {
      updateData.metadata = validated.metadata;
    }

    return this.prisma.deployment.update({
      where: { deploymentId: validated.deploymentId },
      data: updateData,
      include: {
        organization: true,
      },
    });
  }

  // DeploymentLog operations
  async createDeploymentLog(data: CreateDeploymentLogInput): Promise<DeploymentLog> {
    const validated = CreateDeploymentLogSchema.parse(data);
    return this.prisma.deploymentLog.create({
      data: validated,
    });
  }

  async createDeploymentLogs(logs: CreateDeploymentLogInput[]): Promise<void> {
    const validated = logs.map(log => CreateDeploymentLogSchema.parse(log));
    await this.prisma.deploymentLog.createMany({
      data: validated,
    });
  }

  async getDeploymentLogs(
    deploymentId: string,
    level?: LogLevel,
    limit = 100
  ): Promise<DeploymentLog[]> {
    const where: any = { deploymentId };
    if (level) {
      where.level = level;
    }

    return this.prisma.deploymentLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  // DeploymentRollback operations
  async createDeploymentRollback(data: CreateDeploymentRollbackInput): Promise<DeploymentRollback> {
    const validated = CreateDeploymentRollbackSchema.parse(data);
    return this.prisma.deploymentRollback.create({
      data: {
        ...validated,
        status: RollbackStatus.PENDING,
      },
      include: {
        deployment: true,
        user: true,
      },
    });
  }

  async getRollbackById(rollbackId: string): Promise<DeploymentRollback | null> {
    return this.prisma.deploymentRollback.findUnique({
      where: { id: rollbackId },
      include: {
        deployment: true,
        user: true,
      },
    });
  }

  async getRollbacksByDeployment(deploymentId: string): Promise<DeploymentRollback[]> {
    return this.prisma.deploymentRollback.findMany({
      where: { deploymentId },
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRollbackStatus(data: UpdateRollbackStatusInput): Promise<DeploymentRollback> {
    const validated = UpdateRollbackStatusSchema.parse(data);
    const updateData: any = {
      status: validated.status,
    };

    if (validated.completedAt) {
      updateData.completedAt = validated.completedAt;
    }

    if (validated.error) {
      updateData.error = validated.error;
    }

    return this.prisma.deploymentRollback.update({
      where: { id: validated.rollbackId },
      data: updateData,
      include: {
        deployment: true,
        user: true,
      },
    });
  }

  // Utility methods
  async getActiveDeployments(organizationId?: string): Promise<Deployment[]> {
    const where: any = {
      status: {
        in: ['PENDING', 'IN_PROGRESS', 'DEPLOYING'],
      },
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.deployment.findMany({
      where,
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDeploymentHistory(
    userId: string,
    limit = 50
  ): Promise<Deployment[]> {
    return this.prisma.deployment.findMany({
      where: {
        organization: {
          userId,
        },
      },
      include: {
        organization: true,
        logs: {
          where: { level: LogLevel.ERROR },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Cleanup methods
  async deleteOldLogs(daysToKeep = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.deploymentLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}