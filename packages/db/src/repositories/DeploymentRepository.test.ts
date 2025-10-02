import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentRepository } from './DeploymentRepository';
import { PrismaClient, LogLevel, RollbackStatus } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

const prismaMock = mockDeep<PrismaClient>();

describe('DeploymentRepository', () => {
  let repository: DeploymentRepository;

  beforeEach(() => {
    mockReset(prismaMock);
    repository = new DeploymentRepository(prismaMock);
  });

  describe('createDeployment', () => {
    it('should create a new deployment', async () => {
      const deploymentData = {
        organizationId: 'org-123',
        deploymentId: 'deploy-456',
        status: 'PENDING',
        metadata: { components: ['CustomField__c'] },
      };

      const expectedDeployment = {
        id: 'deployment-id',
        ...deploymentData,
        createdAt: new Date(),
        updatedAt: new Date(),
        organization: { id: 'org-123', name: 'Test Org' },
      };

      prismaMock.deployment.create.mockResolvedValue(expectedDeployment as any);

      const result = await repository.createDeployment(deploymentData);

      expect(result).toEqual(expectedDeployment);
      expect(prismaMock.deployment.create).toHaveBeenCalledWith({
        data: deploymentData,
        include: { organization: true },
      });
    });

    it('should throw error for invalid deployment data', async () => {
      const invalidData = {
        organizationId: 'org-123',
        // missing deploymentId
        status: 'PENDING',
        metadata: {},
      } as any;

      await expect(repository.createDeployment(invalidData)).rejects.toThrow();
    });
  });

  describe('createDeploymentLog', () => {
    it('should create a deployment log', async () => {
      const logData = {
        deploymentId: 'deploy-456',
        level: LogLevel.INFO,
        message: 'Deployment started',
        metadata: { timestamp: new Date().toISOString() },
      };

      const expectedLog = {
        id: 'log-id',
        ...logData,
        timestamp: new Date(),
      };

      prismaMock.deploymentLog.create.mockResolvedValue(expectedLog as any);

      const result = await repository.createDeploymentLog(logData);

      expect(result).toEqual(expectedLog);
      expect(prismaMock.deploymentLog.create).toHaveBeenCalledWith({
        data: logData,
      });
    });
  });

  describe('createDeploymentLogs', () => {
    it('should create multiple deployment logs', async () => {
      const logs = [
        {
          deploymentId: 'deploy-456',
          level: LogLevel.INFO,
          message: 'Starting deployment',
        },
        {
          deploymentId: 'deploy-456',
          level: LogLevel.WARNING,
          message: 'Test coverage below threshold',
        },
      ];

      prismaMock.deploymentLog.createMany.mockResolvedValue({ count: 2 });

      await repository.createDeploymentLogs(logs);

      expect(prismaMock.deploymentLog.createMany).toHaveBeenCalledWith({
        data: logs,
      });
    });
  });

  describe('getDeploymentLogs', () => {
    it('should retrieve deployment logs', async () => {
      const deploymentId = 'deploy-456';
      const expectedLogs = [
        {
          id: 'log-1',
          deploymentId,
          level: LogLevel.INFO,
          message: 'Log 1',
          timestamp: new Date(),
          metadata: null,
        },
        {
          id: 'log-2',
          deploymentId,
          level: LogLevel.ERROR,
          message: 'Log 2',
          timestamp: new Date(),
          metadata: null,
        },
      ];

      prismaMock.deploymentLog.findMany.mockResolvedValue(expectedLogs);

      const result = await repository.getDeploymentLogs(deploymentId);

      expect(result).toEqual(expectedLogs);
      expect(prismaMock.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { deploymentId },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    });

    it('should filter logs by level', async () => {
      const deploymentId = 'deploy-456';
      const level = LogLevel.ERROR;

      prismaMock.deploymentLog.findMany.mockResolvedValue([]);

      await repository.getDeploymentLogs(deploymentId, level, 50);

      expect(prismaMock.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { deploymentId, level },
        orderBy: { timestamp: 'desc' },
        take: 50,
      });
    });
  });

  describe('createDeploymentRollback', () => {
    it('should create a deployment rollback', async () => {
      const rollbackData = {
        deploymentId: 'deploy-456',
        rollbackMetadata: { originalState: {} },
        reason: 'Tests failed',
        initiatedBy: 'user-123',
      };

      const expectedRollback = {
        id: 'rollback-id',
        ...rollbackData,
        status: RollbackStatus.PENDING,
        createdAt: new Date(),
        completedAt: null,
        error: null,
        deployment: { id: 'deploy-456' },
        user: { id: 'user-123', email: 'test@example.com' },
      };

      prismaMock.deploymentRollback.create.mockResolvedValue(expectedRollback as any);

      const result = await repository.createDeploymentRollback(rollbackData);

      expect(result).toEqual(expectedRollback);
      expect(prismaMock.deploymentRollback.create).toHaveBeenCalledWith({
        data: {
          ...rollbackData,
          status: RollbackStatus.PENDING,
        },
        include: {
          deployment: true,
          user: true,
        },
      });
    });
  });

  describe('updateRollbackStatus', () => {
    it('should update rollback status to completed', async () => {
      const updateData = {
        rollbackId: 'rollback-id',
        status: RollbackStatus.COMPLETED,
        completedAt: new Date(),
      };

      const expectedRollback = {
        id: 'rollback-id',
        deploymentId: 'deploy-456',
        status: RollbackStatus.COMPLETED,
        completedAt: updateData.completedAt,
        deployment: { id: 'deploy-456' },
        user: { id: 'user-123' },
      };

      prismaMock.deploymentRollback.update.mockResolvedValue(expectedRollback as any);

      const result = await repository.updateRollbackStatus(updateData);

      expect(result).toEqual(expectedRollback);
      expect(prismaMock.deploymentRollback.update).toHaveBeenCalledWith({
        where: { id: updateData.rollbackId },
        data: {
          status: updateData.status,
          completedAt: updateData.completedAt,
        },
        include: {
          deployment: true,
          user: true,
        },
      });
    });

    it('should update rollback status to failed with error', async () => {
      const updateData = {
        rollbackId: 'rollback-id',
        status: RollbackStatus.FAILED,
        error: 'Rollback failed due to permissions',
      };

      prismaMock.deploymentRollback.update.mockResolvedValue({} as any);

      await repository.updateRollbackStatus(updateData);

      expect(prismaMock.deploymentRollback.update).toHaveBeenCalledWith({
        where: { id: updateData.rollbackId },
        data: {
          status: updateData.status,
          error: updateData.error,
        },
        include: {
          deployment: true,
          user: true,
        },
      });
    });
  });

  describe('getActiveDeployments', () => {
    it('should get active deployments', async () => {
      const expectedDeployments = [
        {
          id: 'deploy-1',
          status: 'IN_PROGRESS',
          organizationId: 'org-123',
        },
        {
          id: 'deploy-2',
          status: 'PENDING',
          organizationId: 'org-456',
        },
      ];

      prismaMock.deployment.findMany.mockResolvedValue(expectedDeployments as any);

      const result = await repository.getActiveDeployments();

      expect(result).toEqual(expectedDeployments);
      expect(prismaMock.deployment.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'DEPLOYING'],
          },
        },
        include: { organization: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteOldLogs', () => {
    it('should delete logs older than specified days', async () => {
      const daysToKeep = 30;
      prismaMock.deploymentLog.deleteMany.mockResolvedValue({ count: 150 });

      const result = await repository.deleteOldLogs(daysToKeep);

      expect(result).toBe(150);
      expect(prismaMock.deploymentLog.deleteMany).toHaveBeenCalled();
      
      const callArg = prismaMock.deploymentLog.deleteMany.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg).toHaveProperty('where');
      expect(callArg?.where).toHaveProperty('timestamp');
      expect(callArg?.where?.timestamp).toHaveProperty('lt');
    });
  });
});