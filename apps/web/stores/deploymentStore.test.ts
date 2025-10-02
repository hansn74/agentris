import { describe, it, expect, beforeEach } from 'vitest';
import { useDeploymentStore } from './deploymentStore';

describe('deploymentStore', () => {
  beforeEach(() => {
    useDeploymentStore.getState().reset();
  });

  describe('Active Deployments', () => {
    it('should add an active deployment', () => {
      const deployment = {
        id: '1',
        deploymentId: 'deploy-123',
        status: 'IN_PROGRESS',
        organizationId: 'org-456',
        organizationName: 'Test Org',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useDeploymentStore.getState().addActiveDeployment(deployment);

      const state = useDeploymentStore.getState();
      expect(state.activeDeployments.get('deploy-123')).toEqual(deployment);
    });

    it('should update deployment status', () => {
      const deployment = {
        id: '1',
        deploymentId: 'deploy-123',
        status: 'IN_PROGRESS',
        organizationId: 'org-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useDeploymentStore.getState().addActiveDeployment(deployment);
      useDeploymentStore.getState().updateDeploymentStatus('deploy-123', 'SUCCEEDED', { itemCount: 5 });

      const state = useDeploymentStore.getState();
      const updated = state.activeDeployments.get('deploy-123');
      expect(updated?.status).toBe('SUCCEEDED');
      expect(updated?.metadata).toEqual({ itemCount: 5 });
    });

    it('should remove active deployment', () => {
      const deployment = {
        id: '1',
        deploymentId: 'deploy-123',
        status: 'COMPLETED',
        organizationId: 'org-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      useDeploymentStore.getState().addActiveDeployment(deployment);
      useDeploymentStore.getState().removeActiveDeployment('deploy-123');

      const state = useDeploymentStore.getState();
      expect(state.activeDeployments.get('deploy-123')).toBeUndefined();
    });
  });

  describe('Deployment Logs', () => {
    it('should add deployment log', () => {
      const log = {
        id: 'log-1',
        deploymentId: 'deploy-123',
        level: 'INFO' as const,
        message: 'Deployment started',
        timestamp: new Date(),
      };

      useDeploymentStore.getState().addDeploymentLog('deploy-123', log);

      const state = useDeploymentStore.getState();
      const logs = state.deploymentLogs.get('deploy-123');
      expect(logs).toHaveLength(1);
      expect(logs?.[0]).toEqual(log);
    });

    it('should set deployment logs', () => {
      const logs = [
        {
          id: 'log-1',
          deploymentId: 'deploy-123',
          level: 'INFO' as const,
          message: 'Log 1',
          timestamp: new Date(),
        },
        {
          id: 'log-2',
          deploymentId: 'deploy-123',
          level: 'ERROR' as const,
          message: 'Log 2',
          timestamp: new Date(),
        },
      ];

      useDeploymentStore.getState().setDeploymentLogs('deploy-123', logs);

      const state = useDeploymentStore.getState();
      expect(state.deploymentLogs.get('deploy-123')).toEqual(logs);
    });
  });

  describe('Rollback History', () => {
    it('should add rollback', () => {
      const rollback = {
        id: 'rollback-1',
        deploymentId: 'deploy-123',
        status: 'PENDING' as const,
        reason: 'Test rollback',
        initiatedBy: 'user-123',
        createdAt: new Date(),
      };

      useDeploymentStore.getState().addRollback('deploy-123', rollback);

      const state = useDeploymentStore.getState();
      const rollbacks = state.rollbackHistory.get('deploy-123');
      expect(rollbacks).toHaveLength(1);
      expect(rollbacks?.[0]).toEqual(rollback);
    });

    it('should update rollback status', () => {
      const rollback = {
        id: 'rollback-1',
        deploymentId: 'deploy-123',
        status: 'PENDING' as const,
        reason: 'Test rollback',
        initiatedBy: 'user-123',
        createdAt: new Date(),
      };

      useDeploymentStore.getState().addRollback('deploy-123', rollback);
      useDeploymentStore.getState().updateRollbackStatus('rollback-1', 'COMPLETED');

      const state = useDeploymentStore.getState();
      const rollbacks = state.rollbackHistory.get('deploy-123');
      expect(rollbacks?.[0].status).toBe('COMPLETED');
      expect(rollbacks?.[0].completedAt).toBeDefined();
    });
  });

  describe('UI State', () => {
    it('should set selected deployment ID', () => {
      useDeploymentStore.getState().setSelectedDeploymentId('deploy-123');
      expect(useDeploymentStore.getState().selectedDeploymentId).toBe('deploy-123');
    });

    it('should set selected org ID', () => {
      useDeploymentStore.getState().setSelectedOrgId('org-456');
      expect(useDeploymentStore.getState().selectedOrgId).toBe('org-456');
    });

    it('should update deployment options', () => {
      useDeploymentStore.getState().setDeploymentOptions({
        runTests: true,
        checkOnly: true,
      });

      const state = useDeploymentStore.getState();
      expect(state.deploymentOptions.runTests).toBe(true);
      expect(state.deploymentOptions.checkOnly).toBe(true);
      expect(state.deploymentOptions.rollbackOnError).toBe(true); // Unchanged
    });

    it('should set deploying state', () => {
      useDeploymentStore.getState().setIsDeploying(true);
      expect(useDeploymentStore.getState().isDeploying).toBe(true);
    });

    it('should set error', () => {
      useDeploymentStore.getState().setError('Test error');
      expect(useDeploymentStore.getState().error).toBe('Test error');
    });
  });

  describe('Clear and Reset', () => {
    it('should clear deployment data', () => {
      const deployment = {
        id: '1',
        deploymentId: 'deploy-123',
        status: 'COMPLETED',
        organizationId: 'org-456',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const log = {
        id: 'log-1',
        deploymentId: 'deploy-123',
        level: 'INFO' as const,
        message: 'Test',
        timestamp: new Date(),
      };

      useDeploymentStore.getState().addActiveDeployment(deployment);
      useDeploymentStore.getState().addDeploymentLog('deploy-123', log);
      useDeploymentStore.getState().clearDeploymentData('deploy-123');

      const state = useDeploymentStore.getState();
      expect(state.activeDeployments.get('deploy-123')).toBeUndefined();
      expect(state.deploymentLogs.get('deploy-123')).toBeUndefined();
    });

    it('should reset store to initial state', () => {
      useDeploymentStore.getState().setSelectedDeploymentId('deploy-123');
      useDeploymentStore.getState().setIsDeploying(true);
      useDeploymentStore.getState().setError('Test error');
      
      useDeploymentStore.getState().reset();

      const state = useDeploymentStore.getState();
      expect(state.selectedDeploymentId).toBeNull();
      expect(state.isDeploying).toBe(false);
      expect(state.error).toBeNull();
      expect(state.activeDeployments.size).toBe(0);
    });
  });
});