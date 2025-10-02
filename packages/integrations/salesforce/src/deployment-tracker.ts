import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { ConnectionManager } from './connection';
import {
  DeploymentInfo,
  DeploymentStatus,
  DeploymentDetails,
  DeploymentError,
} from './types/metadata';

const logger = pino({ name: 'salesforce-deployment-tracker' });

export interface DeploymentTrackerOptions {
  pollingInterval?: number; // milliseconds
  maxPollAttempts?: number;
  queueMaxSize?: number;
}

export class DeploymentTracker {
  private connectionManager: ConnectionManager;
  private prisma: PrismaClient;
  private deploymentQueue: Map<string, DeploymentQueueItem>;
  private options: Required<DeploymentTrackerOptions>;

  constructor(prisma: PrismaClient, options: DeploymentTrackerOptions = {}) {
    this.prisma = prisma;
    this.connectionManager = new ConnectionManager(prisma);
    this.deploymentQueue = new Map();
    this.options = {
      pollingInterval: options.pollingInterval || 5000, // 5 seconds default
      maxPollAttempts: options.maxPollAttempts || 120, // 10 minutes with 5s interval
      queueMaxSize: options.queueMaxSize || 10,
    };
  }

  async checkDeploymentStatus(
    userId: string,
    orgId: string,
    deploymentId: string
  ): Promise<DeploymentInfo> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new DeploymentError('No connection available', deploymentId);
      }

      logger.info({ orgId, deploymentId }, 'Checking deployment status');

      const result = await conn.metadata.checkDeployStatus(deploymentId);

      const deploymentInfo: DeploymentInfo = {
        id: result.id,
        status: this.mapDeploymentStatus(result.status),
        done: result.done,
        numberComponentsDeployed: result.numberComponentsDeployed || 0,
        numberComponentsTotal: result.numberComponentsTotal || 0,
        numberComponentErrors: result.numberComponentErrors || 0,
        numberTestsCompleted: result.numberTestsCompleted || 0,
        numberTestsTotal: result.numberTestsTotal || 0,
        createdDate: new Date(result.createdDate),
        startDate: result.startDate ? new Date(result.startDate) : undefined,
        lastModifiedDate: result.lastModifiedDate ? new Date(result.lastModifiedDate) : undefined,
        completedDate: result.completedDate ? new Date(result.completedDate) : undefined,
        createdBy: result.createdBy,
        details: result.details ? this.mapDeploymentDetails(result.details) : undefined,
        errorMessage: result.errorMessage,
      };

      // Update deployment status in database
      await this.updateDeploymentInDatabase(deploymentId, deploymentInfo);

      logger.info(
        {
          orgId,
          deploymentId,
          status: deploymentInfo.status,
          done: deploymentInfo.done,
        },
        'Deployment status checked'
      );

      return deploymentInfo;
    } catch (error) {
      logger.error({ error, orgId, deploymentId }, 'Failed to check deployment status');
      throw new DeploymentError(
        `Failed to check deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        deploymentId
      );
    }
  }

  async pollDeploymentStatus(
    userId: string,
    orgId: string,
    deploymentId: string,
    onProgress?: (info: DeploymentInfo) => void
  ): Promise<DeploymentInfo> {
    let attempts = 0;

    logger.info({ orgId, deploymentId }, 'Starting deployment polling');

    while (attempts < this.options.maxPollAttempts) {
      try {
        const deploymentInfo = await this.checkDeploymentStatus(userId, orgId, deploymentId);

        // Call progress callback if provided
        if (onProgress) {
          onProgress(deploymentInfo);
        }

        // Check if deployment is complete
        if (deploymentInfo.done) {
          logger.info(
            {
              orgId,
              deploymentId,
              status: deploymentInfo.status,
              attempts: attempts + 1,
            },
            'Deployment completed'
          );

          return deploymentInfo;
        }

        // Wait before next poll
        await this.sleep(this.options.pollingInterval);
        attempts++;
      } catch (error) {
        logger.error(
          {
            error,
            orgId,
            deploymentId,
            attempt: attempts + 1,
          },
          'Error during deployment polling'
        );

        // If it's not the last attempt, continue polling
        if (attempts < this.options.maxPollAttempts - 1) {
          await this.sleep(this.options.pollingInterval);
          attempts++;
          continue;
        }

        throw error;
      }
    }

    // Max attempts reached
    throw new DeploymentError(
      `Deployment polling timeout after ${attempts} attempts`,
      deploymentId,
      'InProgress'
    );
  }

  async addToQueue(
    userId: string,
    orgId: string,
    deploymentId: string,
    metadata?: any
  ): Promise<void> {
    if (this.deploymentQueue.size >= this.options.queueMaxSize) {
      throw new DeploymentError(
        `Deployment queue is full (max: ${this.options.queueMaxSize})`,
        deploymentId
      );
    }

    const queueItem: DeploymentQueueItem = {
      userId,
      orgId,
      deploymentId,
      metadata,
      addedAt: new Date(),
      status: 'Pending',
    };

    this.deploymentQueue.set(deploymentId, queueItem);

    logger.info(
      {
        orgId,
        deploymentId,
        queueSize: this.deploymentQueue.size,
      },
      'Deployment added to queue'
    );
  }

  async processQueue(): Promise<Map<string, DeploymentInfo>> {
    const results = new Map<string, DeploymentInfo>();

    for (const [deploymentId, item] of this.deploymentQueue) {
      if (item.status === 'Pending') {
        try {
          // Update queue item status
          item.status = 'InProgress';

          // Poll deployment status
          const deploymentInfo = await this.pollDeploymentStatus(
            item.userId,
            item.orgId,
            deploymentId
          );

          // Update queue item status
          item.status = deploymentInfo.status;
          results.set(deploymentId, deploymentInfo);

          // Remove from queue if done
          if (deploymentInfo.done) {
            this.deploymentQueue.delete(deploymentId);
          }
        } catch (error) {
          logger.error({ error, deploymentId }, 'Failed to process queued deployment');
          item.status = 'Failed';
        }
      }
    }

    return results;
  }

  getQueueStatus(): DeploymentQueueStatus {
    const items = Array.from(this.deploymentQueue.values());

    return {
      size: this.deploymentQueue.size,
      maxSize: this.options.queueMaxSize,
      pending: items.filter((i) => i.status === 'Pending').length,
      inProgress: items.filter((i) => i.status === 'InProgress').length,
      failed: items.filter((i) => i.status === 'Failed').length,
      items: items.map((i) => ({
        deploymentId: i.deploymentId,
        orgId: i.orgId,
        status: i.status,
        addedAt: i.addedAt,
      })),
    };
  }

  async getDeploymentHistory(orgId: string, limit: number = 10): Promise<any[]> {
    try {
      const deployments = await this.prisma.deployment.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      logger.info({ orgId, count: deployments.length }, 'Retrieved deployment history');
      return deployments;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to retrieve deployment history');
      throw new DeploymentError(
        `Failed to retrieve deployment history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ''
      );
    }
  }

  async rollbackDeployment(userId: string, orgId: string, deploymentId: string): Promise<string> {
    try {
      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new DeploymentError('No connection available', deploymentId);
      }

      logger.info({ orgId, deploymentId }, 'Initiating deployment rollback');

      // Cancel the deployment if it's still in progress
      const currentStatus = await this.checkDeploymentStatus(userId, orgId, deploymentId);

      if (!currentStatus.done && currentStatus.status === 'InProgress') {
        // Cancel the deployment
        await conn.metadata.cancelDeploy(deploymentId);

        logger.info({ orgId, deploymentId }, 'Deployment cancelled');

        // Update database
        await this.prisma.deployment.update({
          where: { deploymentId },
          data: {
            status: 'Canceled',
            metadata: {
              ...(await this.getDeploymentMetadata(deploymentId)),
              cancelledAt: new Date().toISOString(),
              cancelledBy: userId,
            },
          },
        });

        return 'Deployment cancelled successfully';
      } else if (currentStatus.done && currentStatus.status === 'Succeeded') {
        // For completed deployments, we would need to deploy the previous version
        // This is a complex operation that would require retrieving the previous metadata
        // For now, we'll just log this scenario
        logger.warn(
          {
            orgId,
            deploymentId,
          },
          'Cannot rollback completed deployment - manual intervention required'
        );

        return 'Completed deployments require manual rollback';
      } else {
        return `Deployment is in ${currentStatus.status} state - no action taken`;
      }
    } catch (error) {
      logger.error({ error, orgId, deploymentId }, 'Failed to rollback deployment');
      throw new DeploymentError(
        `Failed to rollback deployment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        deploymentId
      );
    }
  }

  private async updateDeploymentInDatabase(
    deploymentId: string,
    deploymentInfo: DeploymentInfo
  ): Promise<void> {
    try {
      await this.prisma.deployment.update({
        where: { deploymentId },
        data: {
          status: deploymentInfo.status,
          metadata: {
            ...deploymentInfo,
            lastChecked: new Date().toISOString(),
          } as any, // Cast to any for Prisma JsonValue
        },
      });
    } catch (error) {
      // Log error but don't throw - this is a non-critical operation
      logger.error({ error, deploymentId }, 'Failed to update deployment in database');
    }
  }

  private async getDeploymentMetadata(deploymentId: string): Promise<any> {
    try {
      const deployment = await this.prisma.deployment.findUnique({
        where: { deploymentId },
        select: { metadata: true },
      });
      return deployment?.metadata || {};
    } catch (error) {
      logger.error({ error, deploymentId }, 'Failed to get deployment metadata');
      return {};
    }
  }

  private mapDeploymentStatus(status: string): DeploymentStatus {
    const statusMap: { [key: string]: DeploymentStatus } = {
      Pending: 'Pending',
      InProgress: 'InProgress',
      Succeeded: 'Succeeded',
      SucceededPartial: 'SucceededPartial',
      Failed: 'Failed',
      Canceling: 'Canceling',
      Canceled: 'Canceled',
    };

    return statusMap[status] || 'InProgress';
  }

  private mapDeploymentDetails(details: any): DeploymentDetails {
    return {
      componentSuccesses: details.componentSuccesses || [],
      componentFailures: details.componentFailures || [],
      runTestResult: details.runTestResult,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface DeploymentQueueItem {
  userId: string;
  orgId: string;
  deploymentId: string;
  metadata?: any;
  addedAt: Date;
  status: DeploymentStatus | 'Pending';
}

interface DeploymentQueueStatus {
  size: number;
  maxSize: number;
  pending: number;
  inProgress: number;
  failed: number;
  items: Array<{
    deploymentId: string;
    orgId: string;
    status: DeploymentStatus | 'Pending';
    addedAt: Date;
  }>;
}
