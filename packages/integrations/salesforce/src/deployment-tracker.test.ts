import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { DeploymentTracker } from './deployment-tracker';
import { ConnectionManager } from './connection';
import { DeploymentError } from './types/metadata';

vi.mock('./connection');
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('DeploymentTracker', () => {
  let deploymentTracker: DeploymentTracker;
  let mockPrisma: any;
  let mockConnection: any;
  let mockConnectionManager: any;

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {
      deployment: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
    };

    // Mock JSForce connection
    mockConnection = {
      metadata: {
        checkDeployStatus: vi.fn(),
        cancelDeploy: vi.fn(),
      },
    };

    // Mock ConnectionManager
    mockConnectionManager = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    vi.mocked(ConnectionManager).mockImplementation(() => mockConnectionManager);

    deploymentTracker = new DeploymentTracker(mockPrisma, {
      pollingInterval: 100, // Fast polling for tests
      maxPollAttempts: 3,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkDeploymentStatus', () => {
    it('should successfully check deployment status', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'InProgress',
        done: false,
        numberComponentsDeployed: 5,
        numberComponentsTotal: 10,
        numberComponentErrors: 0,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
        details: {
          componentSuccesses: [],
          componentFailures: [],
        },
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);
      mockPrisma.deployment.update.mockResolvedValue({});

      const result = await deploymentTracker.checkDeploymentStatus('userId', 'orgId', 'deploy123');

      expect(result.id).toBe('deploy123');
      expect(result.status).toBe('InProgress');
      expect(result.done).toBe(false);
      expect(result.numberComponentsDeployed).toBe(5);
      expect(mockConnection.metadata.checkDeployStatus).toHaveBeenCalledWith('deploy123');
      expect(mockPrisma.deployment.update).toHaveBeenCalled();
    });

    it('should throw DeploymentError when connection is not available', async () => {
      mockConnectionManager.getConnection.mockResolvedValue(null);

      await expect(
        deploymentTracker.checkDeploymentStatus('userId', 'orgId', 'deploy123')
      ).rejects.toThrow(DeploymentError);
    });

    it('should handle deployment with errors', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'Failed',
        done: true,
        numberComponentsDeployed: 3,
        numberComponentsTotal: 10,
        numberComponentErrors: 7,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
        errorMessage: 'Deployment failed',
        details: {
          componentFailures: [
            {
              fullName: 'TestClass',
              componentType: 'ApexClass',
              problemType: 'Error',
              problem: 'Compilation error',
            },
          ],
        },
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);

      const result = await deploymentTracker.checkDeploymentStatus('userId', 'orgId', 'deploy123');

      expect(result.status).toBe('Failed');
      expect(result.done).toBe(true);
      expect(result.numberComponentErrors).toBe(7);
      expect(result.errorMessage).toBe('Deployment failed');
    });
  });

  describe('pollDeploymentStatus', () => {
    it('should poll until deployment is complete', async () => {
      const mockStatuses = [
        {
          id: 'deploy123',
          status: 'InProgress',
          done: false,
          numberComponentsDeployed: 3,
          numberComponentsTotal: 10,
          numberComponentErrors: 0,
          numberTestsCompleted: 0,
          numberTestsTotal: 0,
          createdDate: '2024-01-01T00:00:00Z',
          createdBy: 'user123',
        },
        {
          id: 'deploy123',
          status: 'InProgress',
          done: false,
          numberComponentsDeployed: 7,
          numberComponentsTotal: 10,
          numberComponentErrors: 0,
          numberTestsCompleted: 0,
          numberTestsTotal: 0,
          createdDate: '2024-01-01T00:00:00Z',
          createdBy: 'user123',
        },
        {
          id: 'deploy123',
          status: 'Succeeded',
          done: true,
          numberComponentsDeployed: 10,
          numberComponentsTotal: 10,
          numberComponentErrors: 0,
          numberTestsCompleted: 5,
          numberTestsTotal: 5,
          createdDate: '2024-01-01T00:00:00Z',
          createdBy: 'user123',
          completedDate: '2024-01-01T00:05:00Z',
        },
      ];

      let callCount = 0;
      mockConnection.metadata.checkDeployStatus.mockImplementation(() => {
        return Promise.resolve(mockStatuses[callCount++]);
      });

      const progressUpdates: any[] = [];
      const result = await deploymentTracker.pollDeploymentStatus(
        'userId',
        'orgId',
        'deploy123',
        (info) => progressUpdates.push(info)
      );

      expect(result.status).toBe('Succeeded');
      expect(result.done).toBe(true);
      expect(mockConnection.metadata.checkDeployStatus).toHaveBeenCalledTimes(3);
      expect(progressUpdates).toHaveLength(3);
      expect(progressUpdates[0].numberComponentsDeployed).toBe(3);
      expect(progressUpdates[1].numberComponentsDeployed).toBe(7);
      expect(progressUpdates[2].numberComponentsDeployed).toBe(10);
    });

    it('should timeout after max attempts', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'InProgress',
        done: false,
        numberComponentsDeployed: 5,
        numberComponentsTotal: 10,
        numberComponentErrors: 0,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);

      await expect(
        deploymentTracker.pollDeploymentStatus('userId', 'orgId', 'deploy123')
      ).rejects.toThrow('Deployment polling timeout after 3 attempts');

      expect(mockConnection.metadata.checkDeployStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle errors during polling', async () => {
      let callCount = 0;
      mockConnection.metadata.checkDeployStatus.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          id: 'deploy123',
          status: 'InProgress',
          done: false,
          numberComponentsDeployed: 5,
          numberComponentsTotal: 10,
          numberComponentErrors: 0,
          numberTestsCompleted: 0,
          numberTestsTotal: 0,
          createdDate: '2024-01-01T00:00:00Z',
          createdBy: 'user123',
        });
      });

      await expect(
        deploymentTracker.pollDeploymentStatus('userId', 'orgId', 'deploy123')
      ).rejects.toThrow();

      // Should continue polling after error
      expect(mockConnection.metadata.checkDeployStatus).toHaveBeenCalledTimes(3);
    });
  });

  describe('queue management', () => {
    it('should add deployment to queue', async () => {
      await deploymentTracker.addToQueue('userId', 'orgId', 'deploy123', { test: 'data' });

      const queueStatus = deploymentTracker.getQueueStatus();
      expect(queueStatus.size).toBe(1);
      expect(queueStatus.pending).toBe(1);
      expect(queueStatus.items[0].deploymentId).toBe('deploy123');
    });

    it('should throw error when queue is full', async () => {
      const tracker = new DeploymentTracker(mockPrisma, { queueMaxSize: 2 });

      await tracker.addToQueue('userId', 'orgId', 'deploy1');
      await tracker.addToQueue('userId', 'orgId', 'deploy2');

      await expect(tracker.addToQueue('userId', 'orgId', 'deploy3')).rejects.toThrow(
        'Deployment queue is full'
      );
    });

    it('should process queued deployments', async () => {
      await deploymentTracker.addToQueue('userId', 'orgId', 'deploy123');
      await deploymentTracker.addToQueue('userId', 'orgId', 'deploy456');

      const mockStatus = {
        id: 'deploy123',
        status: 'Succeeded',
        done: true,
        numberComponentsDeployed: 10,
        numberComponentsTotal: 10,
        numberComponentErrors: 0,
        numberTestsCompleted: 5,
        numberTestsTotal: 5,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);

      const results = await deploymentTracker.processQueue();

      expect(results.size).toBe(2);
      expect(results.get('deploy123')?.status).toBe('Succeeded');

      // Completed deployments should be removed from queue
      const queueStatus = deploymentTracker.getQueueStatus();
      expect(queueStatus.size).toBe(0);
    });
  });

  describe('getDeploymentHistory', () => {
    it('should retrieve deployment history', async () => {
      const mockDeployments = [
        {
          id: '1',
          deploymentId: 'deploy123',
          organizationId: 'orgId',
          status: 'Succeeded',
          metadata: {},
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: '2',
          deploymentId: 'deploy456',
          organizationId: 'orgId',
          status: 'Failed',
          metadata: {},
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      mockPrisma.deployment.findMany.mockResolvedValue(mockDeployments);

      const history = await deploymentTracker.getDeploymentHistory('orgId', 5);

      expect(history).toEqual(mockDeployments);
      expect(mockPrisma.deployment.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'orgId' },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('rollbackDeployment', () => {
    it('should cancel in-progress deployment', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'InProgress',
        done: false,
        numberComponentsDeployed: 5,
        numberComponentsTotal: 10,
        numberComponentErrors: 0,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);
      mockConnection.metadata.cancelDeploy.mockResolvedValue({});
      mockPrisma.deployment.findUnique.mockResolvedValue({
        metadata: { originalData: 'test' },
      });
      mockPrisma.deployment.update.mockResolvedValue({});

      const result = await deploymentTracker.rollbackDeployment('userId', 'orgId', 'deploy123');

      expect(result).toBe('Deployment cancelled successfully');
      expect(mockConnection.metadata.cancelDeploy).toHaveBeenCalledWith('deploy123');
      expect(mockPrisma.deployment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deploymentId: 'deploy123' },
          data: expect.objectContaining({
            status: 'Canceled',
          }),
        })
      );
    });

    it('should handle completed deployments', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'Succeeded',
        done: true,
        numberComponentsDeployed: 10,
        numberComponentsTotal: 10,
        numberComponentErrors: 0,
        numberTestsCompleted: 5,
        numberTestsTotal: 5,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);

      const result = await deploymentTracker.rollbackDeployment('userId', 'orgId', 'deploy123');

      expect(result).toBe('Completed deployments require manual rollback');
      expect(mockConnection.metadata.cancelDeploy).not.toHaveBeenCalled();
    });

    it('should handle failed deployments', async () => {
      const mockStatus = {
        id: 'deploy123',
        status: 'Failed',
        done: true,
        numberComponentsDeployed: 5,
        numberComponentsTotal: 10,
        numberComponentErrors: 5,
        numberTestsCompleted: 0,
        numberTestsTotal: 0,
        createdDate: '2024-01-01T00:00:00Z',
        createdBy: 'user123',
      };

      mockConnection.metadata.checkDeployStatus.mockResolvedValue(mockStatus);

      const result = await deploymentTracker.rollbackDeployment('userId', 'orgId', 'deploy123');

      expect(result).toBe('Deployment is in Failed state - no action taken');
      expect(mockConnection.metadata.cancelDeploy).not.toHaveBeenCalled();
    });
  });
});
