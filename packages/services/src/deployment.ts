import { PrismaClient, ApprovalStatus, ApprovalItemStatus, LogLevel, RollbackStatus } from '@prisma/client';
import { z } from 'zod';
import pino from 'pino';
import { EventEmitter } from 'events';
import { DeploymentRepository } from '@agentris/db';
import { ApprovalRepository } from '@agentris/db';
import { ApprovalItemRepository } from '@agentris/db';
import { MetadataService } from '@agentris/integrations-salesforce';
import { DeploymentTracker } from '@agentris/integrations-salesforce';

const logger = pino({ name: 'deployment-service' });

// Validation schemas
export const DeployApprovedChangesSchema = z.object({
  approvalId: z.string(),
  targetOrgId: z.string(),
  userId: z.string(),
  options: z.object({
    runTests: z.boolean().default(false),
    checkOnly: z.boolean().default(false),
    rollbackOnError: z.boolean().default(true),
  }).optional(),
});

export const InitiateRollbackSchema = z.object({
  deploymentId: z.string(),
  reason: z.string(),
  userId: z.string(),
});

export type DeployApprovedChangesInput = z.infer<typeof DeployApprovedChangesSchema>;
export type InitiateRollbackInput = z.infer<typeof InitiateRollbackSchema>;

// Event types for real-time updates
export interface DeploymentEvent {
  type: 'status_update' | 'progress' | 'log' | 'completed' | 'failed';
  deploymentId: string;
  data: any;
  timestamp: Date;
}

export class DeploymentService extends EventEmitter {
  private deploymentRepo: DeploymentRepository;
  private approvalRepo: ApprovalRepository;
  private approvalItemRepo: ApprovalItemRepository;
  private metadataService: MetadataService;
  private deploymentTracker: DeploymentTracker;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.deploymentRepo = new DeploymentRepository(prisma);
    this.approvalRepo = new ApprovalRepository(prisma);
    this.approvalItemRepo = new ApprovalItemRepository(prisma);
    this.metadataService = new MetadataService(prisma);
    this.deploymentTracker = new DeploymentTracker(prisma, {
      pollingInterval: 3000, // 3 seconds for more responsive updates
      maxPollAttempts: 200, // ~10 minutes max
    });
  }

  async deployApprovedChanges(input: DeployApprovedChangesInput): Promise<string> {
    const validated = DeployApprovedChangesSchema.parse(input);
    
    try {
      logger.info({ approvalId: validated.approvalId }, 'Starting deployment of approved changes');
      
      // Get approval with items
      const approval = await this.approvalRepo.getApprovalWithItems(validated.approvalId);
      
      if (!approval) {
        throw new Error('Approval not found');
      }
      
      if (approval.status !== ApprovalStatus.APPROVED) {
        throw new Error('Only approved changes can be deployed');
      }
      
      // Get approved items
      const approvedItems = approval.items.filter(
        item => item.status === ApprovalItemStatus.APPROVED || item.status === ApprovalItemStatus.MODIFIED
      );
      
      if (approvedItems.length === 0) {
        throw new Error('No approved items to deploy');
      }
      
      // Convert approved items to metadata format
      const metadataPackage = await this.convertToMetadataPackage(approvedItems);
      
      // Store rollback metadata (current state) before deployment
      const rollbackMetadata = await this.captureCurrentState(validated.targetOrgId, approvedItems);
      
      // Create deployment record
      const deployment = await this.deploymentRepo.createDeployment({
        organizationId: validated.targetOrgId,
        deploymentId: `deploy_${Date.now()}`, // Temporary ID, will update with Salesforce ID
        status: 'PENDING',
        metadata: {
          approvalId: validated.approvalId,
          itemCount: approvedItems.length,
          options: validated.options,
          rollbackMetadata,
        },
      });
      
      // Log deployment start
      await this.deploymentRepo.createDeploymentLog({
        deploymentId: deployment.deploymentId,
        level: LogLevel.INFO,
        message: `Starting deployment of ${approvedItems.length} approved changes`,
        metadata: { approvalId: validated.approvalId },
      });
      
      // Emit start event
      this.emitDeploymentEvent({
        type: 'status_update',
        deploymentId: deployment.deploymentId,
        data: { status: 'STARTING', itemCount: approvedItems.length },
        timestamp: new Date(),
      });
      
      try {
        // Deploy to Salesforce
        const sfDeploymentId = await this.metadataService.deployMetadata(
          validated.userId,
          validated.targetOrgId,
          metadataPackage,
          {
            ...validated.options,
            rollbackOnError: validated.options?.rollbackOnError ?? true,
          }
        );
        
        // Update deployment with Salesforce ID
        await this.deploymentRepo.updateDeploymentStatus({
          deploymentId: deployment.deploymentId,
          status: 'IN_PROGRESS',
          metadata: {
            ...deployment.metadata,
            salesforceDeploymentId: sfDeploymentId,
          },
        });
        
        // Log Salesforce deployment initiated
        await this.deploymentRepo.createDeploymentLog({
          deploymentId: deployment.deploymentId,
          level: LogLevel.INFO,
          message: 'Salesforce deployment initiated',
          metadata: { salesforceDeploymentId: sfDeploymentId },
        });
        
        // Start polling for deployment status
        this.pollDeploymentStatus(
          deployment.deploymentId,
          sfDeploymentId,
          validated.userId,
          validated.targetOrgId
        );
        
        logger.info(
          { deploymentId: deployment.deploymentId, sfDeploymentId },
          'Deployment initiated successfully'
        );
        
        return deployment.deploymentId;
        
      } catch (deployError) {
        // Deployment failed to start
        await this.handleDeploymentFailure(deployment.deploymentId, deployError);
        throw deployError;
      }
      
    } catch (error) {
      logger.error({ error, approvalId: validated.approvalId }, 'Failed to deploy approved changes');
      throw error;
    }
  }

  async initiateRollback(input: InitiateRollbackInput): Promise<string> {
    const validated = InitiateRollbackSchema.parse(input);
    
    try {
      logger.info({ deploymentId: validated.deploymentId }, 'Initiating rollback');
      
      // Get deployment
      const deployment = await this.deploymentRepo.getDeploymentById(validated.deploymentId);
      
      if (!deployment) {
        throw new Error('Deployment not found');
      }
      
      // Check if rollback metadata exists
      const rollbackMetadata = deployment.metadata?.rollbackMetadata;
      
      if (!rollbackMetadata) {
        throw new Error('No rollback metadata available for this deployment');
      }
      
      // Create rollback record
      const rollback = await this.deploymentRepo.createDeploymentRollback({
        deploymentId: validated.deploymentId,
        rollbackMetadata,
        reason: validated.reason,
        initiatedBy: validated.userId,
      });
      
      // Log rollback initiation
      await this.deploymentRepo.createDeploymentLog({
        deploymentId: validated.deploymentId,
        level: LogLevel.WARNING,
        message: `Rollback initiated: ${validated.reason}`,
        metadata: { rollbackId: rollback.id, initiatedBy: validated.userId },
      });
      
      // Emit rollback event
      this.emitDeploymentEvent({
        type: 'status_update',
        deploymentId: validated.deploymentId,
        data: { status: 'ROLLING_BACK', rollbackId: rollback.id },
        timestamp: new Date(),
      });
      
      // Execute rollback
      await this.executeRollback(rollback.id, deployment, rollbackMetadata);
      
      return rollback.id;
      
    } catch (error) {
      logger.error({ error, deploymentId: validated.deploymentId }, 'Failed to initiate rollback');
      throw error;
    }
  }

  private async pollDeploymentStatus(
    deploymentId: string,
    sfDeploymentId: string,
    userId: string,
    orgId: string
  ): Promise<void> {
    try {
      const deploymentInfo = await this.deploymentTracker.pollDeploymentStatus(
        userId,
        orgId,
        sfDeploymentId,
        async (info) => {
          // Progress callback - emit real-time updates
          this.emitDeploymentEvent({
            type: 'progress',
            deploymentId,
            data: {
              status: info.status,
              progress: {
                deployed: info.numberComponentsDeployed,
                total: info.numberComponentsTotal,
                errors: info.numberComponentErrors,
              },
              testsProgress: info.numberTestsTotal > 0 ? {
                completed: info.numberTestsCompleted,
                total: info.numberTestsTotal,
              } : undefined,
            },
            timestamp: new Date(),
          });
          
          // Log significant status changes
          if (info.status !== 'InProgress') {
            await this.deploymentRepo.createDeploymentLog({
              deploymentId,
              level: info.status === 'Failed' ? LogLevel.ERROR : LogLevel.INFO,
              message: `Deployment status: ${info.status}`,
              metadata: { deploymentInfo: info },
            });
          }
        }
      );
      
      // Deployment completed
      if (deploymentInfo.status === 'Succeeded') {
        await this.handleDeploymentSuccess(deploymentId, deploymentInfo);
      } else if (deploymentInfo.status === 'Failed' || deploymentInfo.status === 'Canceled') {
        await this.handleDeploymentFailure(deploymentId, deploymentInfo);
      } else if (deploymentInfo.status === 'SucceededPartial') {
        await this.handlePartialSuccess(deploymentId, deploymentInfo);
      }
      
    } catch (error) {
      logger.error({ error, deploymentId, sfDeploymentId }, 'Error polling deployment status');
      await this.handleDeploymentFailure(deploymentId, error);
    }
  }

  private async handleDeploymentSuccess(deploymentId: string, deploymentInfo: any): Promise<void> {
    await this.deploymentRepo.updateDeploymentStatus({
      deploymentId,
      status: 'SUCCEEDED',
      metadata: { deploymentInfo },
    });
    
    await this.deploymentRepo.createDeploymentLog({
      deploymentId,
      level: LogLevel.INFO,
      message: 'Deployment completed successfully',
      metadata: {
        componentsDeployed: deploymentInfo.numberComponentsDeployed,
        testsRun: deploymentInfo.numberTestsTotal,
      },
    });
    
    this.emitDeploymentEvent({
      type: 'completed',
      deploymentId,
      data: { status: 'SUCCEEDED', deploymentInfo },
      timestamp: new Date(),
    });
  }

  private async handleDeploymentFailure(deploymentId: string, error: any): Promise<void> {
    const errorMessage = error?.errorMessage || error?.message || 'Unknown error';
    
    await this.deploymentRepo.updateDeploymentStatus({
      deploymentId,
      status: 'FAILED',
      metadata: { error: errorMessage, errorDetails: error },
    });
    
    await this.deploymentRepo.createDeploymentLog({
      deploymentId,
      level: LogLevel.ERROR,
      message: `Deployment failed: ${errorMessage}`,
      metadata: { error },
    });
    
    // Check if automatic rollback should be triggered
    const deployment = await this.deploymentRepo.getDeploymentById(deploymentId);
    if (deployment?.metadata?.options?.rollbackOnError) {
      logger.info({ deploymentId }, 'Triggering automatic rollback due to deployment failure');
      
      await this.initiateRollback({
        deploymentId,
        reason: `Automatic rollback due to deployment failure: ${errorMessage}`,
        userId: 'system',
      });
    }
    
    this.emitDeploymentEvent({
      type: 'failed',
      deploymentId,
      data: { status: 'FAILED', error: errorMessage },
      timestamp: new Date(),
    });
  }

  private async handlePartialSuccess(deploymentId: string, deploymentInfo: any): Promise<void> {
    await this.deploymentRepo.updateDeploymentStatus({
      deploymentId,
      status: 'PARTIAL_SUCCESS',
      metadata: { deploymentInfo },
    });
    
    await this.deploymentRepo.createDeploymentLog({
      deploymentId,
      level: LogLevel.WARNING,
      message: 'Deployment partially succeeded',
      metadata: {
        componentsDeployed: deploymentInfo.numberComponentsDeployed,
        componentErrors: deploymentInfo.numberComponentErrors,
        details: deploymentInfo.details,
      },
    });
    
    this.emitDeploymentEvent({
      type: 'completed',
      deploymentId,
      data: { status: 'PARTIAL_SUCCESS', deploymentInfo },
      timestamp: new Date(),
    });
  }

  private async executeRollback(
    rollbackId: string,
    deployment: any,
    rollbackMetadata: any
  ): Promise<void> {
    try {
      // Update rollback status
      await this.deploymentRepo.updateRollbackStatus({
        rollbackId,
        status: RollbackStatus.IN_PROGRESS,
      });
      
      // Convert rollback metadata to deployment package
      const rollbackPackage = await this.createRollbackPackage(rollbackMetadata);
      
      // Deploy the rollback package
      const sfRollbackId = await this.metadataService.deployMetadata(
        deployment.organization.userId,
        deployment.organizationId,
        rollbackPackage,
        {
          rollbackOnError: false, // Don't rollback the rollback
          checkOnly: false,
        }
      );
      
      // Poll rollback status
      const rollbackInfo = await this.deploymentTracker.pollDeploymentStatus(
        deployment.organization.userId,
        deployment.organizationId,
        sfRollbackId
      );
      
      if (rollbackInfo.status === 'Succeeded') {
        await this.deploymentRepo.updateRollbackStatus({
          rollbackId,
          status: RollbackStatus.COMPLETED,
          completedAt: new Date(),
        });
        
        await this.deploymentRepo.createDeploymentLog({
          deploymentId: deployment.deploymentId,
          level: LogLevel.INFO,
          message: 'Rollback completed successfully',
          metadata: { rollbackId, rollbackInfo },
        });
      } else {
        throw new Error(`Rollback failed with status: ${rollbackInfo.status}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.deploymentRepo.updateRollbackStatus({
        rollbackId,
        status: RollbackStatus.FAILED,
        error: errorMessage,
      });
      
      await this.deploymentRepo.createDeploymentLog({
        deploymentId: deployment.deploymentId,
        level: LogLevel.ERROR,
        message: `Rollback failed: ${errorMessage}`,
        metadata: { rollbackId, error },
      });
      
      throw error;
    }
  }

  private async convertToMetadataPackage(approvedItems: any[]): Promise<Buffer> {
    // This would convert approved items to Salesforce metadata package format
    // For now, returning a placeholder - actual implementation would create proper package.xml and metadata files
    const packageXml = this.generatePackageXml(approvedItems);
    const metadataFiles = this.generateMetadataFiles(approvedItems);
    
    // Create zip buffer (placeholder - would use actual zip library)
    return Buffer.from(JSON.stringify({ packageXml, metadataFiles }));
  }

  private async captureCurrentState(orgId: string, items: any[]): Promise<any> {
    // Capture current state of items being deployed for rollback purposes
    const currentState: any = {};
    
    for (const item of items) {
      const itemType = item.previewItem.itemType;
      const itemName = item.previewItem.name;
      
      // Store current state from previewItem
      currentState[`${itemType}:${itemName}`] = item.previewItem.currentState || null;
    }
    
    return currentState;
  }

  private async createRollbackPackage(rollbackMetadata: any): Promise<Buffer> {
    // Convert rollback metadata to deployment package
    // This would restore the previous state
    return Buffer.from(JSON.stringify(rollbackMetadata));
  }

  private generatePackageXml(items: any[]): string {
    // Generate package.xml for deployment
    const types = new Map<string, string[]>();
    
    for (const item of items) {
      const itemType = item.previewItem.itemType;
      const itemName = item.previewItem.name;
      
      if (!types.has(itemType)) {
        types.set(itemType, []);
      }
      types.get(itemType)!.push(itemName);
    }
    
    let packageXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    packageXml += '<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n';
    
    for (const [type, members] of types) {
      packageXml += '  <types>\n';
      for (const member of members) {
        packageXml += `    <members>${member}</members>\n`;
      }
      packageXml += `    <name>${type}</name>\n`;
      packageXml += '  </types>\n';
    }
    
    packageXml += '  <version>59.0</version>\n';
    packageXml += '</Package>';
    
    return packageXml;
  }

  private generateMetadataFiles(items: any[]): any {
    // Generate actual metadata files for deployment
    const files: any = {};
    
    for (const item of items) {
      const itemType = item.previewItem.itemType;
      const itemName = item.previewItem.name;
      const metadata = item.modifiedData || item.previewItem.proposedState;
      
      files[`${itemType}/${itemName}`] = metadata;
    }
    
    return files;
  }

  private emitDeploymentEvent(event: DeploymentEvent): void {
    this.emit('deployment:update', event);
    logger.debug({ event }, 'Deployment event emitted');
  }

  // Public methods for querying deployment status
  async getDeploymentStatus(deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepo.getDeploymentById(deploymentId);
    
    if (!deployment) {
      throw new Error('Deployment not found');
    }
    
    return {
      deploymentId: deployment.deploymentId,
      status: deployment.status,
      metadata: deployment.metadata,
      logs: deployment.logs,
      rollbacks: deployment.rollbacks,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }

  async getDeploymentLogs(deploymentId: string, level?: LogLevel): Promise<any[]> {
    return this.deploymentRepo.getDeploymentLogs(deploymentId, level);
  }

  async getDeploymentHistory(userId: string, limit = 50): Promise<any[]> {
    return this.deploymentRepo.getDeploymentHistory(userId, limit);
  }
}