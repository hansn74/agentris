import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DeploymentService } from './deployment';
import { PrismaClient, ApprovalStatus, ApprovalItemStatus, LogLevel, RollbackStatus } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock modules
vi.mock('@agentris/integrations-salesforce', () => ({
  MetadataService: vi.fn().mockImplementation(() => ({
    deployMetadata: vi.fn(),
  })),
  DeploymentTracker: vi.fn().mockImplementation(() => ({
    pollDeploymentStatus: vi.fn(),
  })),
}));

const prismaMock = mockDeep<PrismaClient>();

describe('DeploymentService', () => {
  let service: DeploymentService;
  let metadataServiceMock: any;
  let deploymentTrackerMock: any;

  beforeEach(() => {
    mockReset(prismaMock);
    
    // Create service with mocked dependencies
    service = new DeploymentService(prismaMock);
    
    // Get references to mocked services
    metadataServiceMock = (service as any).metadataService;
    deploymentTrackerMock = (service as any).deploymentTracker;
    
    // Setup default mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('deployApprovedChanges', () => {
    it('should successfully deploy approved changes', async () => {
      const approvalId = 'approval-123';
      const targetOrgId = 'org-456';
      const userId = 'user-789';
      
      const mockApproval = {
        id: approvalId,
        status: ApprovalStatus.APPROVED,
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.APPROVED,
            previewItem: {
              itemType: 'CustomField',
              name: 'TestField__c',
              proposedState: { type: 'Text', length: 255 },
              currentState: null,
            },
            modifiedData: null,
          },
        ],
      };
      
      const mockDeployment = {
        id: 'deployment-id',
        deploymentId: 'deploy_123456',
        organizationId: targetOrgId,
        status: 'PENDING',
        metadata: {},
      };
      
      // Mock repository methods
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(mockApproval);
      (service as any).deploymentRepo.createDeployment = vi.fn().mockResolvedValue(mockDeployment);
      (service as any).deploymentRepo.createDeploymentLog = vi.fn().mockResolvedValue({});
      (service as any).deploymentRepo.updateDeploymentStatus = vi.fn().mockResolvedValue({});
      
      // Mock Salesforce deployment
      metadataServiceMock.deployMetadata.mockResolvedValue('sf-deploy-123');
      
      // Mock deployment tracker polling
      deploymentTrackerMock.pollDeploymentStatus.mockImplementation(async (uid, oid, did, callback) => {
        // Simulate progress callback
        if (callback) {
          await callback({
            status: 'InProgress',
            done: false,
            numberComponentsDeployed: 0,
            numberComponentsTotal: 1,
            numberComponentErrors: 0,
            numberTestsCompleted: 0,
            numberTestsTotal: 0,
          });
        }
        
        return {
          status: 'Succeeded',
          done: true,
          numberComponentsDeployed: 1,
          numberComponentsTotal: 1,
          numberComponentErrors: 0,
        };
      });
      
      const result = await service.deployApprovedChanges({
        approvalId,
        targetOrgId,
        userId,
        options: {
          runTests: false,
          checkOnly: false,
          rollbackOnError: true,
        },
      });
      
      expect(result).toBe(mockDeployment.deploymentId);
      expect((service as any).approvalRepo.getApprovalWithItems).toHaveBeenCalledWith(approvalId);
      expect((service as any).deploymentRepo.createDeployment).toHaveBeenCalled();
      expect(metadataServiceMock.deployMetadata).toHaveBeenCalled();
    });

    it('should throw error if approval is not found', async () => {
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(null);
      
      await expect(
        service.deployApprovedChanges({
          approvalId: 'non-existent',
          targetOrgId: 'org-456',
          userId: 'user-789',
        })
      ).rejects.toThrow('Approval not found');
    });

    it('should throw error if approval is not in APPROVED status', async () => {
      const mockApproval = {
        id: 'approval-123',
        status: ApprovalStatus.PENDING,
        items: [],
      };
      
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(mockApproval);
      
      await expect(
        service.deployApprovedChanges({
          approvalId: 'approval-123',
          targetOrgId: 'org-456',
          userId: 'user-789',
        })
      ).rejects.toThrow('Only approved changes can be deployed');
    });

    it('should throw error if no approved items exist', async () => {
      const mockApproval = {
        id: 'approval-123',
        status: ApprovalStatus.APPROVED,
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.REJECTED,
            previewItem: {},
          },
        ],
      };
      
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(mockApproval);
      
      await expect(
        service.deployApprovedChanges({
          approvalId: 'approval-123',
          targetOrgId: 'org-456',
          userId: 'user-789',
        })
      ).rejects.toThrow('No approved items to deploy');
    });

    it('should handle deployment failure and trigger automatic rollback', async () => {
      const mockApproval = {
        id: 'approval-123',
        status: ApprovalStatus.APPROVED,
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.APPROVED,
            previewItem: {
              itemType: 'CustomField',
              name: 'TestField__c',
              proposedState: {},
            },
          },
        ],
      };
      
      const mockDeployment = {
        id: 'deployment-id',
        deploymentId: 'deploy_123456',
        organizationId: 'org-456',
        status: 'PENDING',
        metadata: {
          options: { rollbackOnError: true },
        },
      };
      
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(mockApproval);
      (service as any).deploymentRepo.createDeployment = vi.fn().mockResolvedValue(mockDeployment);
      (service as any).deploymentRepo.createDeploymentLog = vi.fn().mockResolvedValue({});
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(mockDeployment);
      
      // Mock deployment failure
      metadataServiceMock.deployMetadata.mockRejectedValue(new Error('Deployment failed'));
      
      // Spy on initiateRollback
      const initiateRollbackSpy = vi.spyOn(service, 'initiateRollback').mockResolvedValue('rollback-id');
      
      await expect(
        service.deployApprovedChanges({
          approvalId: 'approval-123',
          targetOrgId: 'org-456',
          userId: 'user-789',
        })
      ).rejects.toThrow('Deployment failed');
    });
  });

  describe('initiateRollback', () => {
    it('should successfully initiate rollback', async () => {
      const deploymentId = 'deploy_123456';
      const userId = 'user-789';
      const reason = 'Manual rollback requested';
      
      const mockDeployment = {
        deploymentId,
        organizationId: 'org-456',
        metadata: {
          rollbackMetadata: {
            'CustomField:TestField__c': { type: 'Text', length: 100 },
          },
        },
        organization: {
          userId,
        },
      };
      
      const mockRollback = {
        id: 'rollback-123',
        deploymentId,
        status: RollbackStatus.PENDING,
      };
      
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(mockDeployment);
      (service as any).deploymentRepo.createDeploymentRollback = vi.fn().mockResolvedValue(mockRollback);
      (service as any).deploymentRepo.createDeploymentLog = vi.fn().mockResolvedValue({});
      (service as any).deploymentRepo.updateRollbackStatus = vi.fn().mockResolvedValue({});
      
      // Mock rollback execution
      metadataServiceMock.deployMetadata.mockResolvedValue('sf-rollback-123');
      deploymentTrackerMock.pollDeploymentStatus.mockResolvedValue({
        status: 'Succeeded',
        done: true,
      });
      
      const result = await service.initiateRollback({
        deploymentId,
        reason,
        userId,
      });
      
      expect(result).toBe(mockRollback.id);
      expect((service as any).deploymentRepo.getDeploymentById).toHaveBeenCalledWith(deploymentId);
      expect((service as any).deploymentRepo.createDeploymentRollback).toHaveBeenCalledWith({
        deploymentId,
        rollbackMetadata: mockDeployment.metadata.rollbackMetadata,
        reason,
        initiatedBy: userId,
      });
    });

    it('should throw error if deployment not found', async () => {
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(null);
      
      await expect(
        service.initiateRollback({
          deploymentId: 'non-existent',
          reason: 'Test',
          userId: 'user-123',
        })
      ).rejects.toThrow('Deployment not found');
    });

    it('should throw error if no rollback metadata available', async () => {
      const mockDeployment = {
        deploymentId: 'deploy_123456',
        metadata: {}, // No rollbackMetadata
      };
      
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(mockDeployment);
      
      await expect(
        service.initiateRollback({
          deploymentId: 'deploy_123456',
          reason: 'Test',
          userId: 'user-123',
        })
      ).rejects.toThrow('No rollback metadata available for this deployment');
    });
  });

  describe('getDeploymentStatus', () => {
    it('should return deployment status', async () => {
      const deploymentId = 'deploy_123456';
      const mockDeployment = {
        deploymentId,
        status: 'IN_PROGRESS',
        metadata: { itemCount: 5 },
        logs: [
          { level: LogLevel.INFO, message: 'Deployment started' },
        ],
        rollbacks: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(mockDeployment);
      
      const result = await service.getDeploymentStatus(deploymentId);
      
      expect(result).toMatchObject({
        deploymentId,
        status: 'IN_PROGRESS',
        metadata: { itemCount: 5 },
      });
      expect((service as any).deploymentRepo.getDeploymentById).toHaveBeenCalledWith(deploymentId);
    });

    it('should throw error if deployment not found', async () => {
      (service as any).deploymentRepo.getDeploymentById = vi.fn().mockResolvedValue(null);
      
      await expect(
        service.getDeploymentStatus('non-existent')
      ).rejects.toThrow('Deployment not found');
    });
  });

  describe('getDeploymentLogs', () => {
    it('should return deployment logs', async () => {
      const deploymentId = 'deploy_123456';
      const mockLogs = [
        {
          id: 'log-1',
          deploymentId,
          level: LogLevel.INFO,
          message: 'Deployment started',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          deploymentId,
          level: LogLevel.ERROR,
          message: 'Component failed',
          timestamp: new Date(),
        },
      ];
      
      (service as any).deploymentRepo.getDeploymentLogs = vi.fn().mockResolvedValue(mockLogs);
      
      const result = await service.getDeploymentLogs(deploymentId);
      
      expect(result).toEqual(mockLogs);
      expect((service as any).deploymentRepo.getDeploymentLogs).toHaveBeenCalledWith(
        deploymentId,
        undefined
      );
    });

    it('should filter logs by level', async () => {
      const deploymentId = 'deploy_123456';
      const level = LogLevel.ERROR;
      
      (service as any).deploymentRepo.getDeploymentLogs = vi.fn().mockResolvedValue([]);
      
      await service.getDeploymentLogs(deploymentId, level);
      
      expect((service as any).deploymentRepo.getDeploymentLogs).toHaveBeenCalledWith(
        deploymentId,
        level
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit deployment events', async () => {
      const eventHandler = vi.fn();
      service.on('deployment:update', eventHandler);
      
      const mockApproval = {
        id: 'approval-123',
        status: ApprovalStatus.APPROVED,
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.APPROVED,
            previewItem: {
              itemType: 'CustomField',
              name: 'TestField__c',
              proposedState: {},
            },
          },
        ],
      };
      
      const mockDeployment = {
        deploymentId: 'deploy_123456',
        status: 'PENDING',
        metadata: {},
      };
      
      (service as any).approvalRepo.getApprovalWithItems = vi.fn().mockResolvedValue(mockApproval);
      (service as any).deploymentRepo.createDeployment = vi.fn().mockResolvedValue(mockDeployment);
      (service as any).deploymentRepo.createDeploymentLog = vi.fn().mockResolvedValue({});
      (service as any).deploymentRepo.updateDeploymentStatus = vi.fn().mockResolvedValue({});
      
      metadataServiceMock.deployMetadata.mockResolvedValue('sf-deploy-123');
      deploymentTrackerMock.pollDeploymentStatus.mockResolvedValue({
        status: 'Succeeded',
        done: true,
      });
      
      await service.deployApprovedChanges({
        approvalId: 'approval-123',
        targetOrgId: 'org-456',
        userId: 'user-789',
      });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(eventHandler).toHaveBeenCalled();
      const events = eventHandler.mock.calls.map(call => call[0]);
      expect(events.some(e => e.type === 'status_update')).toBe(true);
    });
  });
});