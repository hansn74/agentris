import { PrismaClient, LogLevel } from '@prisma/client';
import { DeploymentRepository } from '@agentris/db';
import pino from 'pino';

const logger = pino({ name: 'deployment-logger' });

export interface LogContext {
  deploymentId: string;
  userId?: string;
  operation?: string;
  metadata?: any;
}

export class DeploymentLogger {
  private deploymentRepo: DeploymentRepository;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.deploymentRepo = new DeploymentRepository(prisma);
  }

  /**
   * Log an info message
   */
  async info(context: LogContext, message: string, metadata?: any): Promise<void> {
    await this.log(LogLevel.INFO, context, message, metadata);
  }

  /**
   * Log a warning message
   */
  async warning(context: LogContext, message: string, metadata?: any): Promise<void> {
    await this.log(LogLevel.WARNING, context, message, metadata);
  }

  /**
   * Log an error message
   */
  async error(context: LogContext, message: string, error?: Error | any, metadata?: any): Promise<void> {
    const errorMetadata = {
      ...metadata,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    };
    
    await this.log(LogLevel.ERROR, context, message, errorMetadata);
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogLevel,
    context: LogContext,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Log to console/file via pino
      const logData = {
        ...context,
        level,
        message,
        metadata,
      };
      
      switch (level) {
        case LogLevel.INFO:
          logger.info(logData);
          break;
        case LogLevel.WARNING:
          logger.warn(logData);
          break;
        case LogLevel.ERROR:
          logger.error(logData);
          break;
      }

      // Store in database
      if (context.deploymentId) {
        await this.deploymentRepo.createDeploymentLog({
          deploymentId: context.deploymentId,
          level,
          message,
          metadata: {
            ...metadata,
            userId: context.userId,
            operation: context.operation,
          },
        });
      }
    } catch (error) {
      // Log to console if database logging fails
      logger.error({
        message: 'Failed to write deployment log to database',
        originalMessage: message,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Log deployment lifecycle events
   */
  async logDeploymentLifecycle(
    deploymentId: string,
    event: 'started' | 'progress' | 'completed' | 'failed' | 'cancelled',
    metadata?: any
  ): Promise<void> {
    const messages = {
      started: 'Deployment started',
      progress: 'Deployment in progress',
      completed: 'Deployment completed successfully',
      failed: 'Deployment failed',
      cancelled: 'Deployment cancelled',
    };

    const level = event === 'failed' ? LogLevel.ERROR :
                  event === 'cancelled' ? LogLevel.WARNING :
                  LogLevel.INFO;

    await this.log(level, { deploymentId, operation: `deployment.${event}` }, messages[event], metadata);
  }

  /**
   * Log rollback events
   */
  async logRollbackEvent(
    deploymentId: string,
    rollbackId: string,
    event: 'initiated' | 'in_progress' | 'completed' | 'failed',
    metadata?: any
  ): Promise<void> {
    const messages = {
      initiated: 'Rollback initiated',
      in_progress: 'Rollback in progress',
      completed: 'Rollback completed successfully',
      failed: 'Rollback failed',
    };

    const level = event === 'failed' ? LogLevel.ERROR : LogLevel.INFO;

    await this.log(
      level,
      { deploymentId, operation: `rollback.${event}` },
      messages[event],
      { ...metadata, rollbackId }
    );
  }

  /**
   * Log component deployment status
   */
  async logComponentStatus(
    deploymentId: string,
    componentName: string,
    componentType: string,
    status: 'deploying' | 'deployed' | 'failed',
    error?: string
  ): Promise<void> {
    const message = `Component ${componentName} (${componentType}): ${status}`;
    const level = status === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
    
    await this.log(
      level,
      { deploymentId, operation: 'component.deploy' },
      message,
      { componentName, componentType, status, error }
    );
  }

  /**
   * Log test execution results
   */
  async logTestResults(
    deploymentId: string,
    testsRun: number,
    testsPassed: number,
    testsFailed: number,
    details?: any
  ): Promise<void> {
    const level = testsFailed > 0 ? LogLevel.WARNING : LogLevel.INFO;
    const message = `Test execution: ${testsPassed}/${testsRun} passed, ${testsFailed} failed`;
    
    await this.log(
      level,
      { deploymentId, operation: 'test.execution' },
      message,
      { testsRun, testsPassed, testsFailed, details }
    );
  }

  /**
   * Create a logger middleware for deployment operations
   */
  createMiddleware() {
    return {
      before: async (context: LogContext, operation: string) => {
        await this.info(
          { ...context, operation },
          `Starting operation: ${operation}`
        );
      },
      
      after: async (context: LogContext, operation: string, result?: any) => {
        await this.info(
          { ...context, operation },
          `Completed operation: ${operation}`,
          { result: result ? 'success' : 'no-result' }
        );
      },
      
      error: async (context: LogContext, operation: string, error: Error) => {
        await this.error(
          { ...context, operation },
          `Failed operation: ${operation}`,
          error
        );
      },
    };
  }

  /**
   * Batch log multiple entries
   */
  async batchLog(deploymentId: string, logs: Array<{
    level: LogLevel;
    message: string;
    metadata?: any;
  }>): Promise<void> {
    const logEntries = logs.map(log => ({
      deploymentId,
      level: log.level,
      message: log.message,
      metadata: log.metadata,
    }));

    try {
      await this.deploymentRepo.createDeploymentLogs(logEntries);
      
      // Also log to console
      logs.forEach(log => {
        const logData = { deploymentId, ...log };
        switch (log.level) {
          case LogLevel.INFO:
            logger.info(logData);
            break;
          case LogLevel.WARNING:
            logger.warn(logData);
            break;
          case LogLevel.ERROR:
            logger.error(logData);
            break;
        }
      });
    } catch (error) {
      logger.error({
        message: 'Failed to batch write deployment logs',
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Clean up old logs
   */
  async cleanupOldLogs(daysToKeep = 30): Promise<number> {
    try {
      const deletedCount = await this.deploymentRepo.deleteOldLogs(daysToKeep);
      logger.info({
        message: `Cleaned up ${deletedCount} old deployment logs`,
        daysToKeep,
      });
      return deletedCount;
    } catch (error) {
      logger.error({
        message: 'Failed to cleanup old logs',
        error: error instanceof Error ? error.message : error,
      });
      return 0;
    }
  }
}