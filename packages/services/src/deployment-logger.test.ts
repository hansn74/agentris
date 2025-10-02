import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentLogger } from './deployment-logger';
import { PrismaClient, LogLevel } from '@prisma/client';
import { mockDeep, mockReset } from 'vitest-mock-extended';

// Mock pino
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock DeploymentRepository
vi.mock('@agentris/db', () => ({
  DeploymentRepository: vi.fn().mockImplementation(() => ({
    createDeploymentLog: vi.fn(),
    createDeploymentLogs: vi.fn(),
    deleteOldLogs: vi.fn(),
  })),
}));

const prismaMock = mockDeep<PrismaClient>();

describe('DeploymentLogger', () => {
  let logger: DeploymentLogger;

  beforeEach(() => {
    mockReset(prismaMock);
    logger = new DeploymentLogger(prismaMock);
    vi.clearAllMocks();
  });

  describe('info', () => {
    it('should log info message', async () => {
      const context = {
        deploymentId: 'deploy-123',
        userId: 'user-456',
        operation: 'test',
      };

      await logger.info(context, 'Test info message', { extra: 'data' });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.INFO,
        message: 'Test info message',
        metadata: {
          extra: 'data',
          userId: 'user-456',
          operation: 'test',
        },
      });
    });
  });

  describe('warning', () => {
    it('should log warning message', async () => {
      const context = {
        deploymentId: 'deploy-123',
      };

      await logger.warning(context, 'Test warning message');

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.WARNING,
        message: 'Test warning message',
        metadata: {
          userId: undefined,
          operation: undefined,
        },
      });
    });
  });

  describe('error', () => {
    it('should log error message with Error object', async () => {
      const context = {
        deploymentId: 'deploy-123',
      };
      const error = new Error('Test error');
      error.stack = 'Test stack trace';

      await logger.error(context, 'Test error message', error);

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.ERROR,
        message: 'Test error message',
        metadata: {
          error: {
            message: 'Test error',
            stack: 'Test stack trace',
            name: 'Error',
          },
          userId: undefined,
          operation: undefined,
        },
      });
    });

    it('should log error message with custom error object', async () => {
      const context = {
        deploymentId: 'deploy-123',
      };
      const customError = { code: 'CUSTOM_ERROR', details: 'Something went wrong' };

      await logger.error(context, 'Test error message', customError);

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.ERROR,
        message: 'Test error message',
        metadata: {
          error: customError,
          userId: undefined,
          operation: undefined,
        },
      });
    });
  });

  describe('logDeploymentLifecycle', () => {
    it('should log deployment started event', async () => {
      await logger.logDeploymentLifecycle('deploy-123', 'started', { itemCount: 5 });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.INFO,
        message: 'Deployment started',
        metadata: {
          itemCount: 5,
          userId: undefined,
          operation: 'deployment.started',
        },
      });
    });

    it('should log deployment failed event as error', async () => {
      await logger.logDeploymentLifecycle('deploy-123', 'failed', { error: 'Connection lost' });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.ERROR,
        message: 'Deployment failed',
        metadata: {
          error: 'Connection lost',
          userId: undefined,
          operation: 'deployment.failed',
        },
      });
    });

    it('should log deployment cancelled as warning', async () => {
      await logger.logDeploymentLifecycle('deploy-123', 'cancelled');

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.WARNING,
        message: 'Deployment cancelled',
        metadata: {
          userId: undefined,
          operation: 'deployment.cancelled',
        },
      });
    });
  });

  describe('logRollbackEvent', () => {
    it('should log rollback initiated', async () => {
      await logger.logRollbackEvent('deploy-123', 'rollback-456', 'initiated', { reason: 'Test failed' });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.INFO,
        message: 'Rollback initiated',
        metadata: {
          reason: 'Test failed',
          rollbackId: 'rollback-456',
          userId: undefined,
          operation: 'rollback.initiated',
        },
      });
    });

    it('should log rollback failed as error', async () => {
      await logger.logRollbackEvent('deploy-123', 'rollback-456', 'failed', { error: 'Permission denied' });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.ERROR,
        message: 'Rollback failed',
        metadata: {
          error: 'Permission denied',
          rollbackId: 'rollback-456',
          userId: undefined,
          operation: 'rollback.failed',
        },
      });
    });
  });

  describe('logComponentStatus', () => {
    it('should log component deployed', async () => {
      await logger.logComponentStatus('deploy-123', 'TestField__c', 'CustomField', 'deployed');

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.INFO,
        message: 'Component TestField__c (CustomField): deployed',
        metadata: {
          componentName: 'TestField__c',
          componentType: 'CustomField',
          status: 'deployed',
          error: undefined,
          userId: undefined,
          operation: 'component.deploy',
        },
      });
    });

    it('should log component failed as error', async () => {
      await logger.logComponentStatus('deploy-123', 'TestField__c', 'CustomField', 'failed', 'Field already exists');

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.ERROR,
        message: 'Component TestField__c (CustomField): failed',
        metadata: {
          componentName: 'TestField__c',
          componentType: 'CustomField',
          status: 'failed',
          error: 'Field already exists',
          userId: undefined,
          operation: 'component.deploy',
        },
      });
    });
  });

  describe('logTestResults', () => {
    it('should log successful test results', async () => {
      await logger.logTestResults('deploy-123', 100, 100, 0);

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.INFO,
        message: 'Test execution: 100/100 passed, 0 failed',
        metadata: {
          testsRun: 100,
          testsPassed: 100,
          testsFailed: 0,
          details: undefined,
          userId: undefined,
          operation: 'test.execution',
        },
      });
    });

    it('should log failed test results as warning', async () => {
      await logger.logTestResults('deploy-123', 100, 95, 5, { failedTests: ['Test1', 'Test2'] });

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLog).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        level: LogLevel.WARNING,
        message: 'Test execution: 95/100 passed, 5 failed',
        metadata: {
          testsRun: 100,
          testsPassed: 95,
          testsFailed: 5,
          details: { failedTests: ['Test1', 'Test2'] },
          userId: undefined,
          operation: 'test.execution',
        },
      });
    });
  });

  describe('batchLog', () => {
    it('should batch log multiple entries', async () => {
      const logs = [
        { level: LogLevel.INFO, message: 'Log 1', metadata: { data: 1 } },
        { level: LogLevel.WARNING, message: 'Log 2' },
        { level: LogLevel.ERROR, message: 'Log 3', metadata: { error: 'test' } },
      ];

      await logger.batchLog('deploy-123', logs);

      const repo = (logger as any).deploymentRepo;
      expect(repo.createDeploymentLogs).toHaveBeenCalledWith([
        { deploymentId: 'deploy-123', level: LogLevel.INFO, message: 'Log 1', metadata: { data: 1 } },
        { deploymentId: 'deploy-123', level: LogLevel.WARNING, message: 'Log 2', metadata: undefined },
        { deploymentId: 'deploy-123', level: LogLevel.ERROR, message: 'Log 3', metadata: { error: 'test' } },
      ]);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should cleanup old logs', async () => {
      const repo = (logger as any).deploymentRepo;
      repo.deleteOldLogs.mockResolvedValue(150);

      const result = await logger.cleanupOldLogs(30);

      expect(result).toBe(150);
      expect(repo.deleteOldLogs).toHaveBeenCalledWith(30);
    });

    it('should handle cleanup errors', async () => {
      const repo = (logger as any).deploymentRepo;
      repo.deleteOldLogs.mockRejectedValue(new Error('Database error'));

      const result = await logger.cleanupOldLogs(30);

      expect(result).toBe(0);
    });
  });

  describe('createMiddleware', () => {
    it('should create middleware functions', () => {
      const middleware = logger.createMiddleware();

      expect(middleware).toHaveProperty('before');
      expect(middleware).toHaveProperty('after');
      expect(middleware).toHaveProperty('error');
      expect(typeof middleware.before).toBe('function');
      expect(typeof middleware.after).toBe('function');
      expect(typeof middleware.error).toBe('function');
    });
  });
});