import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { deploymentRouter } from './deployment';
import { TRPCError } from '@trpc/server';
import { PrismaClient, ApprovalStatus, LogLevel } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock DeploymentService
vi.mock('@agentris/services', () => ({
  DeploymentService: vi.fn().mockImplementation(() => ({
    deployApprovedChanges: vi.fn(),
    initiateRollback: vi.fn(),
    getDeploymentStatus: vi.fn(),
    getDeploymentLogs: vi.fn(),
    getDeploymentHistory: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  })),
  DeploymentEvent: {},
}));

const prismaMock = mockDeep<PrismaClient>();

describe('deploymentRouter', () => {
  let ctx: any;
  let caller: any;

  beforeEach(() => {
    mockReset(prismaMock);
    
    // Create context with mocked prisma
    ctx = createInnerTRPCContext({
      session: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      },
      prisma: prismaMock,
    });
    
    // Create caller with context
    caller = deploymentRouter.createCaller(ctx);
    
    vi.clearAllMocks();
  });

  describe('deployChanges', () => {
    it('should successfully deploy approved changes', async () => {
      const input = {
        approvalId: 'approval-123',
        targetOrgId: 'org-456',
        options: {
          runTests: false,
          checkOnly: false,
          rollbackOnError: true,
        },
      };
      
      // Mock org and approval exist
      prismaMock.salesforceOrganization.findFirst.mockResolvedValue({
        id: 'org-456',
        userId: 'user-123',
        name: 'Test Org',
      } as any);
      
      prismaMock.approval.findFirst.mockResolvedValue({
        id: 'approval-123',
        userId: 'user-123',
        status: ApprovalStatus.APPROVED,
      } as any);
      
      // Mock DeploymentService
      const DeploymentService = (await import('@agentris/services')).DeploymentService;
      const mockInstance = new DeploymentService(prismaMock);
      (mockInstance.deployApprovedChanges as any).mockResolvedValue('deploy-789');
      
      const result = await caller.deployChanges(input);
      
      expect(result).toEqual({
        success: true,
        deploymentId: 'deploy-789',
        message: 'Deployment initiated successfully',
      });
    });

    it('should throw FORBIDDEN if user does not have permission to deploy to org', async () => {
      const input = {
        approvalId: 'approval-123',
        targetOrgId: 'org-456',
      };
      
      prismaMock.salesforceOrganization.findFirst.mockResolvedValue(null);
      
      await expect(caller.deployChanges(input)).rejects.toThrow(TRPCError);
      await expect(caller.deployChanges(input)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('should throw NOT_FOUND if approval does not exist', async () => {
      const input = {
        approvalId: 'approval-123',
        targetOrgId: 'org-456',
      };
      
      prismaMock.salesforceOrganization.findFirst.mockResolvedValue({
        id: 'org-456',
        userId: 'user-123',
      } as any);
      
      prismaMock.approval.findFirst.mockResolvedValue(null);
      
      await expect(caller.deployChanges(input)).rejects.toThrow(TRPCError);
      await expect(caller.deployChanges(input)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getDeploymentStatusQuery', () => {
    it('should return deployment status', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        organizationId: 'org-456',
      } as any);
      
      const DeploymentService = (await import('@agentris/services')).DeploymentService;
      const mockInstance = new DeploymentService(prismaMock);
      (mockInstance.getDeploymentStatus as any).mockResolvedValue({
        deploymentId,
        status: 'IN_PROGRESS',
        metadata: { itemCount: 5 },
        logs: [],
        rollbacks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const result = await caller.getDeploymentStatusQuery({ deploymentId });
      
      expect(result).toMatchObject({
        deploymentId,
        status: 'IN_PROGRESS',
      });
    });

    it('should throw NOT_FOUND if deployment does not exist', async () => {
      prismaMock.deployment.findFirst.mockResolvedValue(null);
      
      await expect(
        caller.getDeploymentStatusQuery({ deploymentId: 'non-existent' })
      ).rejects.toThrow(TRPCError);
      await expect(
        caller.getDeploymentStatusQuery({ deploymentId: 'non-existent' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('rollbackDeployment', () => {
    it('should successfully initiate rollback', async () => {
      const input = {
        deploymentId: 'deploy-123',
        reason: 'Manual rollback requested',
      };
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId: 'deploy-123',
        organizationId: 'org-456',
      } as any);
      
      const DeploymentService = (await import('@agentris/services')).DeploymentService;
      const mockInstance = new DeploymentService(prismaMock);
      (mockInstance.initiateRollback as any).mockResolvedValue('rollback-456');
      
      const result = await caller.rollbackDeployment(input);
      
      expect(result).toEqual({
        success: true,
        rollbackId: 'rollback-456',
        message: 'Rollback initiated successfully',
      });
    });

    it('should throw NOT_FOUND if deployment does not exist', async () => {
      const input = {
        deploymentId: 'non-existent',
        reason: 'Test',
      };
      
      prismaMock.deployment.findFirst.mockResolvedValue(null);
      
      await expect(caller.rollbackDeployment(input)).rejects.toThrow(TRPCError);
      await expect(caller.rollbackDeployment(input)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('getDeploymentLogs', () => {
    it('should return deployment logs', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        organizationId: 'org-456',
      } as any);
      
      const mockLogs = [
        {
          id: 'log-1',
          level: LogLevel.INFO,
          message: 'Deployment started',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          level: LogLevel.ERROR,
          message: 'Component failed',
          timestamp: new Date(),
        },
      ];
      
      const DeploymentService = (await import('@agentris/services')).DeploymentService;
      const mockInstance = new DeploymentService(prismaMock);
      (mockInstance.getDeploymentLogs as any).mockResolvedValue(mockLogs);
      
      const result = await caller.getDeploymentLogs({
        deploymentId,
        limit: 10,
      });
      
      expect(result).toMatchObject({
        logs: mockLogs,
        total: 2,
        hasMore: false,
      });
    });

    it('should filter logs by level', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        organizationId: 'org-456',
      } as any);
      
      const DeploymentService = (await import('@agentris/services')).DeploymentService;
      const mockInstance = new DeploymentService(prismaMock);
      (mockInstance.getDeploymentLogs as any).mockResolvedValue([]);
      
      await caller.getDeploymentLogs({
        deploymentId,
        level: LogLevel.ERROR,
        limit: 10,
      });
      
      expect(mockInstance.getDeploymentLogs).toHaveBeenCalledWith(
        deploymentId,
        LogLevel.ERROR
      );
    });
  });

  describe('getActiveDeployments', () => {
    it('should return active deployments for user', async () => {
      const mockDeployments = [
        {
          id: 'deploy-1',
          deploymentId: 'deploy-1',
          status: 'IN_PROGRESS',
          organization: {
            id: 'org-1',
            name: 'Test Org 1',
            orgType: 'SANDBOX',
          },
        },
        {
          id: 'deploy-2',
          deploymentId: 'deploy-2',
          status: 'PENDING',
          organization: {
            id: 'org-2',
            name: 'Test Org 2',
            orgType: 'PRODUCTION',
          },
        },
      ];
      
      prismaMock.deployment.findMany.mockResolvedValue(mockDeployments as any);
      
      const result = await caller.getActiveDeployments();
      
      expect(result).toEqual({
        deployments: mockDeployments,
        count: 2,
      });
      
      expect(prismaMock.deployment.findMany).toHaveBeenCalledWith({
        where: {
          organization: {
            userId: 'user-123',
          },
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'DEPLOYING'],
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              orgType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('canRollback', () => {
    it('should return true if rollback is available', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        status: 'SUCCEEDED',
        metadata: {
          rollbackMetadata: { someData: true },
        },
      } as any);
      
      const result = await caller.canRollback({ deploymentId });
      
      expect(result).toEqual({
        canRollback: true,
        reason: 'Rollback available',
      });
    });

    it('should return false if no rollback metadata', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        status: 'SUCCEEDED',
        metadata: {},
      } as any);
      
      const result = await caller.canRollback({ deploymentId });
      
      expect(result).toEqual({
        canRollback: false,
        reason: 'No rollback metadata available',
      });
    });

    it('should return false if status does not allow rollback', async () => {
      const deploymentId = 'deploy-123';
      
      prismaMock.deployment.findFirst.mockResolvedValue({
        deploymentId,
        status: 'IN_PROGRESS',
        metadata: {
          rollbackMetadata: { someData: true },
        },
      } as any);
      
      const result = await caller.canRollback({ deploymentId });
      
      expect(result).toEqual({
        canRollback: false,
        reason: 'Cannot rollback deployment in IN_PROGRESS status',
      });
    });
  });
});