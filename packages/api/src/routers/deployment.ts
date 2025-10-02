import { z } from 'zod';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { LogLevel } from '@prisma/client';
import { 
  createTRPCRouter, 
  protectedProcedure,
  publicProcedure 
} from '../trpc';
import { 
  DeploymentService, 
  DeploymentEvent 
} from '@agentris/services';
import { TRPCError } from '@trpc/server';

// Input validation schemas
const deployChangesSchema = z.object({
  approvalId: z.string().min(1, 'Approval ID is required'),
  targetOrgId: z.string().min(1, 'Target organization ID is required'),
  options: z.object({
    runTests: z.boolean().default(false),
    checkOnly: z.boolean().default(false),
    rollbackOnError: z.boolean().default(true),
  }).optional(),
});

const getDeploymentStatusSchema = z.object({
  deploymentId: z.string().min(1, 'Deployment ID is required'),
});

const rollbackDeploymentSchema = z.object({
  deploymentId: z.string().min(1, 'Deployment ID is required'),
  reason: z.string().min(1, 'Reason is required'),
});

const getDeploymentLogsSchema = z.object({
  deploymentId: z.string().min(1, 'Deployment ID is required'),
  level: z.nativeEnum(LogLevel).optional(),
  limit: z.number().min(1).max(500).default(100),
});

const getDeploymentHistorySchema = z.object({
  limit: z.number().min(1).max(100).default(50),
});

export const deploymentRouter = createTRPCRouter({
  // Deploy approved changes
  deployChanges: protectedProcedure
    .input(deployChangesSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deploymentService = new DeploymentService(ctx.prisma);
        
        // Verify user has permission to deploy to the target org
        const org = await ctx.prisma.salesforceOrganization.findFirst({
          where: {
            id: input.targetOrgId,
            userId: ctx.session.user.id,
          },
        });
        
        if (!org) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You do not have permission to deploy to this organization',
          });
        }
        
        // Verify approval exists and belongs to user
        const approval = await ctx.prisma.approval.findFirst({
          where: {
            id: input.approvalId,
            userId: ctx.session.user.id,
          },
        });
        
        if (!approval) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Approval not found or you do not have access to it',
          });
        }
        
        // Deploy the changes
        const deploymentId = await deploymentService.deployApprovedChanges({
          approvalId: input.approvalId,
          targetOrgId: input.targetOrgId,
          userId: ctx.session.user.id,
          options: input.options,
        });
        
        return {
          success: true,
          deploymentId,
          message: 'Deployment initiated successfully',
        };
      } catch (error) {
        console.error('Deployment error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to deploy changes',
        });
      }
    }),

  // Get deployment status with real-time updates (subscription)
  getDeploymentStatus: protectedProcedure
    .input(getDeploymentStatusSchema)
    .subscription(({ ctx, input }) => {
      return observable<DeploymentEvent>((emit) => {
        const deploymentService = new DeploymentService(ctx.prisma);
        
        // Initial status check
        deploymentService.getDeploymentStatus(input.deploymentId)
          .then((status) => {
            emit.next({
              type: 'status_update',
              deploymentId: input.deploymentId,
              data: status,
              timestamp: new Date(),
            });
          })
          .catch((error) => {
            emit.error(new TRPCError({
              code: 'NOT_FOUND',
              message: 'Deployment not found',
            }));
          });
        
        // Subscribe to real-time updates
        const handleUpdate = (event: DeploymentEvent) => {
          if (event.deploymentId === input.deploymentId) {
            emit.next(event);
            
            // Complete subscription if deployment is done
            if (event.type === 'completed' || event.type === 'failed') {
              setTimeout(() => emit.complete(), 1000); // Give time for final update
            }
          }
        };
        
        deploymentService.on('deployment:update', handleUpdate);
        
        // Cleanup on unsubscribe
        return () => {
          deploymentService.off('deployment:update', handleUpdate);
        };
      });
    }),

  // Get deployment status (query)
  getDeploymentStatusQuery: protectedProcedure
    .input(getDeploymentStatusSchema)
    .query(async ({ ctx, input }) => {
      try {
        const deploymentService = new DeploymentService(ctx.prisma);
        
        // Verify user has access to this deployment
        const deployment = await ctx.prisma.deployment.findFirst({
          where: {
            deploymentId: input.deploymentId,
            organization: {
              userId: ctx.session.user.id,
            },
          },
        });
        
        if (!deployment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deployment not found or you do not have access to it',
          });
        }
        
        const status = await deploymentService.getDeploymentStatus(input.deploymentId);
        
        return status;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get deployment status',
        });
      }
    }),

  // Initiate rollback
  rollbackDeployment: protectedProcedure
    .input(rollbackDeploymentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deploymentService = new DeploymentService(ctx.prisma);
        
        // Verify user has access to this deployment
        const deployment = await ctx.prisma.deployment.findFirst({
          where: {
            deploymentId: input.deploymentId,
            organization: {
              userId: ctx.session.user.id,
            },
          },
        });
        
        if (!deployment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deployment not found or you do not have access to it',
          });
        }
        
        const rollbackId = await deploymentService.initiateRollback({
          deploymentId: input.deploymentId,
          reason: input.reason,
          userId: ctx.session.user.id,
        });
        
        return {
          success: true,
          rollbackId,
          message: 'Rollback initiated successfully',
        };
      } catch (error) {
        console.error('Rollback error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to initiate rollback',
        });
      }
    }),

  // Get deployment logs
  getDeploymentLogs: protectedProcedure
    .input(getDeploymentLogsSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Verify user has access to this deployment
        const deployment = await ctx.prisma.deployment.findFirst({
          where: {
            deploymentId: input.deploymentId,
            organization: {
              userId: ctx.session.user.id,
            },
          },
        });
        
        if (!deployment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deployment not found or you do not have access to it',
          });
        }
        
        const deploymentService = new DeploymentService(ctx.prisma);
        const logs = await deploymentService.getDeploymentLogs(
          input.deploymentId,
          input.level
        );
        
        // Limit logs
        const limitedLogs = logs.slice(0, input.limit);
        
        return {
          logs: limitedLogs,
          total: logs.length,
          hasMore: logs.length > input.limit,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get deployment logs',
        });
      }
    }),

  // Get deployment history for the current user
  getDeploymentHistory: protectedProcedure
    .input(getDeploymentHistorySchema)
    .query(async ({ ctx, input }) => {
      try {
        const deploymentService = new DeploymentService(ctx.prisma);
        const history = await deploymentService.getDeploymentHistory(
          ctx.session.user.id,
          input.limit
        );
        
        return {
          deployments: history,
          total: history.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get deployment history',
        });
      }
    }),

  // Get active deployments for the current user
  getActiveDeployments: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const activeDeployments = await ctx.prisma.deployment.findMany({
          where: {
            organization: {
              userId: ctx.session.user.id,
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
        
        return {
          deployments: activeDeployments,
          count: activeDeployments.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get active deployments',
        });
      }
    }),

  // Get rollback history for a deployment
  getRollbackHistory: protectedProcedure
    .input(getDeploymentStatusSchema)
    .query(async ({ ctx, input }) => {
      try {
        // Verify user has access to this deployment
        const deployment = await ctx.prisma.deployment.findFirst({
          where: {
            deploymentId: input.deploymentId,
            organization: {
              userId: ctx.session.user.id,
            },
          },
        });
        
        if (!deployment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Deployment not found or you do not have access to it',
          });
        }
        
        const rollbacks = await ctx.prisma.deploymentRollback.findMany({
          where: {
            deploymentId: input.deploymentId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        return {
          rollbacks,
          count: rollbacks.length,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get rollback history',
        });
      }
    }),

  // Check if deployment can be rolled back
  canRollback: protectedProcedure
    .input(getDeploymentStatusSchema)
    .query(async ({ ctx, input }) => {
      try {
        const deployment = await ctx.prisma.deployment.findFirst({
          where: {
            deploymentId: input.deploymentId,
            organization: {
              userId: ctx.session.user.id,
            },
          },
        });
        
        if (!deployment) {
          return {
            canRollback: false,
            reason: 'Deployment not found',
          };
        }
        
        // Check if rollback metadata exists
        const hasRollbackMetadata = deployment.metadata && 
          (deployment.metadata as any).rollbackMetadata;
        
        if (!hasRollbackMetadata) {
          return {
            canRollback: false,
            reason: 'No rollback metadata available',
          };
        }
        
        // Check deployment status
        const canRollbackStatuses = ['SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS'];
        const canRollback = canRollbackStatuses.includes(deployment.status);
        
        return {
          canRollback,
          reason: canRollback 
            ? 'Rollback available' 
            : `Cannot rollback deployment in ${deployment.status} status`,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check rollback availability',
        });
      }
    }),
});