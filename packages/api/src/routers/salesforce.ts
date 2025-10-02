import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  SalesforceAuthService,
  ConnectionManager,
  TokenRefreshService,
  OrgType,
  OrgTypeSchema,
  MetadataService,
  DeploymentTracker,
  LimitsManager,
  MetadataCache,
  CacheKeys,
  CacheTTL,
  CacheTags,
  customFieldSchema,
  metadataComponentSchema
} from '@agentris/integrations-salesforce';
import { SalesforceStateService } from '../services/salesforce-state';
import { SecurityEventService, AuthEventType } from '../services/security-events';

// Rate limiting for authentication attempts
const authAttempts = new Map<string, { count: number; resetAt: Date }>();

async function checkRateLimit(
  userId: string,
  maxAttempts: number = 5,
  securityService?: SecurityEventService,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const now = new Date();
  const userAttempts = authAttempts.get(userId);
  
  if (userAttempts) {
    if (now < userAttempts.resetAt) {
      if (userAttempts.count >= maxAttempts) {
        // Log security event for rate limit
        if (securityService) {
          await securityService.logEvent({
            userId,
            eventType: AuthEventType.RATE_LIMIT_EXCEEDED,
            service: 'SALESFORCE',
            ipAddress,
            userAgent,
            metadata: { attemptCount: userAttempts.count }
          });
        }
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: `Rate limit exceeded. Try again after ${userAttempts.resetAt.toISOString()}`
        });
      }
      userAttempts.count++;
    } else {
      // Reset the counter
      authAttempts.set(userId, {
        count: 1,
        resetAt: new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes window
      });
    }
  } else {
    authAttempts.set(userId, {
      count: 1,
      resetAt: new Date(now.getTime() + 15 * 60 * 1000)
    });
  }
}

// Clean up expired rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, attempts] of authAttempts.entries()) {
    if (now > attempts.resetAt.getTime()) {
      authAttempts.delete(userId);
    }
  }
}, 5 * 60 * 1000);

const salesforceAuthService = new SalesforceAuthService();

export const salesforceRouter = router({
  connect: protectedProcedure
    .input(z.object({
      orgType: OrgTypeSchema,
      instanceUrl: z.string().url().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const stateService = new SalesforceStateService(ctx.prisma);
        const securityService = new SecurityEventService(ctx.prisma);
        
        // Get IP address and user agent from context
        const ipAddress = ctx.req?.headers?.['x-forwarded-for'] as string || ctx.req?.socket?.remoteAddress;
        const userAgent = ctx.req?.headers?.['user-agent'] as string;
        
        // Check rate limit
        await checkRateLimit(userId, 5, securityService, ipAddress, userAgent);
        
        // Create state token in database
        const state = await stateService.createState(userId, input.orgType);

        const authUrl = salesforceAuthService.getAuthorizationUrl(
          state,
          input.orgType
        );

        return {
          authUrl,
          state
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to initiate Salesforce connection: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  callback: protectedProcedure
    .input(z.object({
      code: z.string(),
      state: z.string(),
      orgType: OrgTypeSchema.optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const stateService = new SalesforceStateService(ctx.prisma);
        const securityService = new SecurityEventService(ctx.prisma);
        
        // Get IP address and user agent from context
        const ipAddress = ctx.req?.headers?.['x-forwarded-for'] as string || ctx.req?.socket?.remoteAddress;
        const userAgent = ctx.req?.headers?.['user-agent'] as string;
        
        // Check rate limit for callback attempts
        await checkRateLimit(userId, 10, securityService, ipAddress, userAgent); // Allow more attempts for callbacks
        
        // Validate CSRF state token using database
        const stateValidation = await stateService.validateState(input.state, userId);
        
        if (!stateValidation.valid) {
          // Log security event for invalid state token
          await securityService.logEvent({
            userId,
            eventType: AuthEventType.INVALID_STATE_TOKEN,
            service: 'SALESFORCE',
            ipAddress,
            userAgent,
            metadata: { error: stateValidation.error }
          });
          
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: stateValidation.error || 'Invalid state token'
          });
        }
        
        const orgType = stateValidation.orgType!;
        
        const connectionManager = new ConnectionManager(ctx.prisma);

        // Authenticate with Salesforce (use orgType from state for security)
        const tokens = await salesforceAuthService.authenticate(
          input.code,
          orgType || input.orgType || OrgType.PRODUCTION
        );

        // Get user identity
        const identity = await salesforceAuthService.getIdentity(
          tokens.accessToken,
          tokens.instanceUrl
        );

        // Store the organization connection
        const organization = await connectionManager.addOrganization(
          userId,
          tokens,
          identity,
          orgType || input.orgType || OrgType.PRODUCTION
        );
        
        // Log successful authentication
        await securityService.logEvent({
          userId,
          eventType: AuthEventType.AUTH_SUCCESS,
          service: 'SALESFORCE',
          ipAddress,
          userAgent,
          metadata: { orgId: organization.orgId }
        });

        return {
          success: true,
          organization: {
            id: organization.id,
            orgId: organization.orgId,
            name: organization.name,
            instanceUrl: organization.instanceUrl,
            type: organization.type
          }
        };
      } catch (error) {
        // Log authentication failure if not already a TRPC error
        if (!(error instanceof TRPCError)) {
          const securityService = new SecurityEventService(ctx.prisma);
          const ipAddress = ctx.req?.headers?.['x-forwarded-for'] as string || ctx.req?.socket?.remoteAddress;
          const userAgent = ctx.req?.headers?.['user-agent'] as string;
          
          await securityService.logEvent({
            userId: ctx.session.user.id,
            eventType: AuthEventType.AUTH_FAILURE,
            service: 'SALESFORCE',
            ipAddress,
            userAgent,
            metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
          });
        }
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to complete Salesforce authentication: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  listOrgs: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.session.user.id;
      const connectionManager = new ConnectionManager(ctx.prisma);
      
      const organizations = await connectionManager.listOrganizations(userId);
      
      return organizations.map(org => ({
        id: org.id,
        orgId: org.orgId,
        name: org.name,
        instanceUrl: org.instanceUrl,
        type: org.type,
        lastSync: org.lastSync,
        createdAt: org.createdAt
      }));
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to list organizations: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      });
    }
  }),

  testConnection: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const connectionManager = new ConnectionManager(ctx.prisma);
        
        const result = await connectionManager.testConnection(userId, input.orgId);
        
        return {
          success: result.success,
          message: result.message,
          identity: result.identity ? {
            username: result.identity.username,
            email: result.identity.email,
            displayName: result.identity.displayName,
            organizationId: result.identity.organizationId
          } : undefined
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Connection test failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  disconnect: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const connectionManager = new ConnectionManager(ctx.prisma);
        
        const success = await connectionManager.removeOrganization(userId, input.orgId);
        
        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found'
          });
        }

        return {
          success: true,
          message: 'Organization disconnected successfully'
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to disconnect organization: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  refreshToken: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const tokenRefreshService = new TokenRefreshService(ctx.prisma);
        const securityService = new SecurityEventService(ctx.prisma);
        
        await tokenRefreshService.refreshTokenForOrganization(userId, input.orgId);
        
        // Log successful token refresh
        await securityService.logEvent({
          userId,
          eventType: AuthEventType.TOKEN_REFRESH_SUCCESS,
          service: 'SALESFORCE',
          metadata: { orgId: input.orgId }
        });
        
        return {
          success: true,
          message: 'Token refreshed successfully'
        };
      } catch (error) {
        // Log token refresh failure
        const securityService = new SecurityEventService(ctx.prisma);
        await securityService.logEvent({
          userId: ctx.session.user.id,
          eventType: AuthEventType.TOKEN_REFRESH_FAILURE,
          service: 'SALESFORCE',
          metadata: { 
            orgId: input.orgId,
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        });
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to refresh token: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  getOrgDetails: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const connectionManager = new ConnectionManager(ctx.prisma);
        
        const organization = await connectionManager.getOrganization(userId, input.orgId);
        
        if (!organization) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Organization not found'
          });
        }

        // Test connection to get current identity info
        const connectionTest = await connectionManager.testConnection(userId, input.orgId);
        
        return {
          id: organization.id,
          orgId: organization.orgId,
          name: organization.name,
          instanceUrl: organization.instanceUrl,
          type: organization.type,
          lastSync: organization.lastSync,
          createdAt: organization.createdAt,
          updatedAt: organization.updatedAt,
          isConnected: connectionTest.success,
          identity: connectionTest.identity
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get organization details: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  // Metadata operations
  describeObjects: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check cache first
        const cacheKey = CacheKeys.orgGlobal(input.orgId);
        const cached = await cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        
        // Fetch from Salesforce
        const result = await metadataService.describeGlobal(userId, input.orgId);
        
        // Cache the result
        await cache.set(cacheKey, result, CacheTTL.LONG, [
          CacheTags.ORG(input.orgId),
          CacheTags.METADATA
        ]);
        
        return result;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to describe objects: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  getFieldMetadata: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      objectName: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check cache first
        const cacheKey = CacheKeys.objectFields(input.orgId, input.objectName);
        const cached = await cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        
        // Fetch from Salesforce
        const fields = await metadataService.listFields(userId, input.orgId, input.objectName);
        
        // Cache the result
        await cache.set(cacheKey, fields, CacheTTL.MEDIUM, [
          CacheTags.ORG(input.orgId),
          CacheTags.OBJECT(input.orgId, input.objectName),
          CacheTags.METADATA
        ]);
        
        return fields;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get field metadata: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  createField: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      objectName: z.string(),
      field: customFieldSchema
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const limitsManager = new LimitsManager(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check API limits before operation
        await limitsManager.checkLimitBeforeOperation(
          userId,
          input.orgId,
          'createField',
          2 // Estimated API calls
        );
        
        // Create the field
        const fieldMetadata = {
          ...input.field,
          fullName: `${input.objectName}.${input.field.fullName}`,
          type: 'CustomField'
        };
        
        const result = await metadataService.createMetadata(
          userId,
          input.orgId,
          'CustomField',
          [fieldMetadata]
        );
        
        // Invalidate cache for this object
        await cache.invalidateByTags([
          CacheTags.OBJECT(input.orgId, input.objectName)
        ]);
        
        return {
          success: result[0]?.success || false,
          fieldName: fieldMetadata.fullName,
          errors: result[0]?.errors
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create field: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  updateField: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      objectName: z.string(),
      field: customFieldSchema
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const limitsManager = new LimitsManager(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check API limits before operation
        await limitsManager.checkLimitBeforeOperation(
          userId,
          input.orgId,
          'updateField',
          2
        );
        
        // Update the field
        const fieldMetadata = {
          ...input.field,
          fullName: `${input.objectName}.${input.field.fullName}`,
          type: 'CustomField'
        };
        
        const result = await metadataService.updateMetadata(
          userId,
          input.orgId,
          'CustomField',
          [fieldMetadata]
        );
        
        // Invalidate cache for this object
        await cache.invalidateByTags([
          CacheTags.OBJECT(input.orgId, input.objectName)
        ]);
        
        return {
          success: result[0]?.success || false,
          fieldName: fieldMetadata.fullName,
          errors: result[0]?.errors
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update field: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  deleteField: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      objectName: z.string(),
      fieldName: z.string()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const limitsManager = new LimitsManager(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check API limits before operation
        await limitsManager.checkLimitBeforeOperation(
          userId,
          input.orgId,
          'deleteField',
          2
        );
        
        // Delete the field
        const fullName = `${input.objectName}.${input.fieldName}`;
        const result = await metadataService.deleteMetadata(
          userId,
          input.orgId,
          'CustomField',
          [fullName]
        );
        
        // Invalidate cache for this object
        await cache.invalidateByTags([
          CacheTags.OBJECT(input.orgId, input.objectName)
        ]);
        
        return {
          success: result[0]?.success || false,
          fieldName: fullName,
          errors: result[0]?.errors
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete field: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  deployChanges: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      metadata: z.array(metadataComponentSchema),
      options: z.object({
        rollbackOnError: z.boolean().optional(),
        runTests: z.boolean().optional(),
        testLevel: z.enum(['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg']).optional()
      }).optional()
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const metadataService = new MetadataService(ctx.prisma);
        const limitsManager = new LimitsManager(ctx.prisma);
        
        // Check API limits before operation
        await limitsManager.checkLimitBeforeOperation(
          userId,
          input.orgId,
          'deployment',
          10 // Deployments use more API calls
        );
        
        // For this example, we'll need to create a zip buffer from metadata
        // In a real implementation, you'd use jsforce's metadata deploy
        // For now, we'll use a placeholder
        const zipBuffer = Buffer.from('placeholder'); // This would be actual metadata package
        
        const deploymentId = await metadataService.deployMetadata(
          userId,
          input.orgId,
          zipBuffer,
          input.options
        );
        
        return {
          success: true,
          deploymentId
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to deploy changes: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  getDeploymentStatus: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      deploymentId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const deploymentTracker = new DeploymentTracker(ctx.prisma);
        
        const status = await deploymentTracker.checkDeploymentStatus(
          userId,
          input.orgId,
          input.deploymentId
        );
        
        return {
          id: status.id,
          status: status.status,
          done: status.done,
          numberComponentsDeployed: status.numberComponentsDeployed,
          numberComponentsTotal: status.numberComponentsTotal,
          numberComponentErrors: status.numberComponentErrors,
          numberTestsCompleted: status.numberTestsCompleted,
          numberTestsTotal: status.numberTestsTotal,
          createdDate: status.createdDate,
          completedDate: status.completedDate,
          errorMessage: status.errorMessage
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get deployment status: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    }),

  getOrgLimits: protectedProcedure
    .input(z.object({
      orgId: z.string()
    }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.session.user.id;
        const limitsManager = new LimitsManager(ctx.prisma);
        const cache = new MetadataCache();
        
        // Check cache first
        const cacheKey = CacheKeys.orgLimits(input.orgId);
        const cached = await cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        
        // Fetch from Salesforce
        const limits = await limitsManager.checkApiLimits(userId, input.orgId);
        
        // Cache for a short time since limits change frequently
        await cache.set(cacheKey, limits, CacheTTL.SHORT, [
          CacheTags.ORG(input.orgId),
          CacheTags.LIMITS
        ]);
        
        return limits;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get org limits: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        });
      }
    })
});
