import { z } from 'zod';
import {
  router,
  protectedProcedure,
  requireConsultant,
  requireManager,
  requireAdmin,
} from '../trpc';
import { TRPCError } from '@trpc/server';

export const integrationRouter = router({
  list: protectedProcedure.query(async () => {
    return [];
  }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async () => {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Integration not found',
    });
  }),

  create: requireManager
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        type: z.enum(['OAUTH2', 'API_KEY', 'WEBHOOK', 'DATABASE', 'FILE_STORAGE', 'MESSAGING']),
        config: z.object({
          authUrl: z.string().url().optional(),
          tokenUrl: z.string().url().optional(),
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
          scope: z.string().optional(),
          webhookUrl: z.string().url().optional(),
          apiEndpoint: z.string().url().optional(),
        }),
        isPublic: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx }) => {
      return {
        id: 'temp-integration-id',
        name: 'Integration',
        isActive: true,
        createdById: ctx.session?.user?.id || 'unknown',
      };
    }),

  update: requireManager
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        config: z.record(z.any()).optional(),
        isActive: z.boolean().optional(),
        isPublic: z.boolean().optional(),
      })
    )
    .mutation(async () => {
      return {
        id: 'temp-integration-id',
        name: 'Updated Integration',
      };
    }),

  delete: requireAdmin.input(z.object({ id: z.string() })).mutation(async () => {
    return { success: true };
  }),

  connect: requireConsultant
    .input(
      z.object({
        integrationId: z.string(),
        name: z.string().min(1).max(100),
        credentials: z.record(z.string()),
        testConnection: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx }) => {
      return {
        id: 'temp-connection-id',
        status: 'TESTING',
        userId: ctx.session?.user?.id || 'unknown',
      };
    }),

  disconnect: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async () => {
      return { success: true };
    }),

  listConnections: protectedProcedure
    .input(
      z.object({
        integrationId: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'TESTING', 'ERROR']).optional(),
      })
    )
    .query(async () => {
      return [];
    }),

  testConnection: protectedProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async () => {
      return {
        testId: 'temp-test-id',
        status: 'PENDING',
      };
    }),

  getWebhooks: requireConsultant
    .input(
      z.object({
        integrationId: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ERROR']).optional(),
      })
    )
    .query(async () => {
      return [];
    }),

  createWebhook: requireManager
    .input(
      z.object({
        integrationId: z.string(),
        url: z.string().url(),
        events: z.array(z.string()).min(1),
        secret: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx }) => {
      return {
        id: 'temp-webhook-id',
        status: 'ACTIVE',
        createdById: ctx.session?.user?.id || 'unknown',
      };
    }),

  getWebhookDeliveries: requireConsultant
    .input(
      z.object({
        webhookId: z.string(),
        status: z.enum(['PENDING', 'SUCCESS', 'FAILED']).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async () => {
      return [];
    }),
});
